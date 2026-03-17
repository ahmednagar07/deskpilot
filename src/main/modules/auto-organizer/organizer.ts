import path from 'path';
import fs from 'fs';
import os from 'os';
import * as fileRepo from '../../database/repositories/file-repo';
import * as settingsRepo from '../../database/repositories/settings-repo';
import * as scanRepo from '../../database/repositories/scan-repo';
import { getCategoryById } from '../file-classifier/categories';
import { suggestBetterName } from './name-suggester';
import { MovePlanItem } from '../../../shared/types';
import { getDatabase } from '../../database/connection';

/**
 * Context-aware subfolder rules.
 *
 * For categories like Clients and Projects, we extract a known entity name
 * from the file's source path and use it as a subfolder. This means:
 *
 *   Desktop/LOC/contract.pdf  →  Organized/Clients/LOC/contract.pdf
 *   Desktop/LOC/logo.png      →  Organized/Clients/LOC/logo.png
 *
 * Instead of the USELESS type-based organization:
 *   Desktop/LOC/contract.pdf  →  Organized/Documents/contract.pdf
 *   Desktop/LOC/logo.png      →  Organized/Media/logo.png
 */

interface PathContextRule {
  categorySlug: string;
  ruleValue: string;   // e.g. "LOC", "Clawdbot"
}

/**
 * Load path_contains rules from the database.
 * These tell us which folder names map to which categories (Clients, Projects, etc.)
 */
function getPathContextRules(): PathContextRule[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT c.slug as category_slug, cr.rule_value
    FROM classification_rules cr
    JOIN categories c ON c.id = cr.category_id
    WHERE cr.rule_type = 'path_contains' AND cr.is_active = 1
    ORDER BY cr.priority ASC
  `).all() as Array<{ category_slug: string; rule_value: string }>;

  return rows.map(r => ({ categorySlug: r.category_slug, ruleValue: r.rule_value }));
}

/**
 * Extract the context subfolder from a file's source path.
 *
 * For a file at `G:/hard/Work/Clients/LOC/docs/contract.pdf`:
 * - If `path_contains: LOC` matched → returns "LOC"
 * - If path has additional subfolders after the match → preserves them: "LOC/docs"
 *
 * For a file at `C:/Users/Desktop/random.pdf` with no context match → returns null.
 */
function extractContextSubfolder(filePath: string, contextRules: PathContextRule[], categorySlug: string): string | null {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');

  // Find matching context rules for this category
  const rulesForCategory = contextRules.filter(r => r.categorySlug === categorySlug);

  for (const rule of rulesForCategory) {
    const ruleValueLower = rule.ruleValue.toLowerCase();

    // Find the matching folder segment in the path
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i].toLowerCase().includes(ruleValueLower)) {
        // Found the context folder. Use the matched folder name as-is (preserving case)
        // and include any subfolders between it and the filename
        const contextFolder = parts[i];
        const subParts = parts.slice(i + 1, parts.length - 1); // folders after match, before filename

        if (subParts.length > 0) {
          return `${contextFolder}/${subParts.join('/')}`;
        }
        return contextFolder;
      }
    }
  }

  return null;
}

/**
 * Generate a move plan for unorganized, classified files.
 * SCOPED to active managed folders only — never pulls files from outside.
 *
 * SMART ORGANIZATION:
 * - Files with context (client/project path) → Organized/Clients/LOC/file.pdf
 * - Files without context (loose on Desktop) → Organized/Documents/file.pdf
 */
export function generateMovePlan(scopeFolderPaths?: string[]): MovePlanItem[] {
  const fallbackRoot = path.join(os.homedir(), 'Documents', 'Organized').replace(/\\/g, '/');
  const organizedRoot = settingsRepo.getSetting<string>('organized_root') || fallbackRoot;

  // Use provided folder paths, or fall back to all active managed folders
  const folderPaths = scopeFolderPaths && scopeFolderPaths.length > 0
    ? scopeFolderPaths
    : scanRepo.getActiveManagedFolders().map(f => f.path);
  const files = fileRepo.getUnorganizedFilesInFolders(folderPaths);
  const plan: MovePlanItem[] = [];

  // Load context rules for smart subfolder detection
  const contextRules = getPathContextRules();

  for (const file of files) {
    // Skip files without a category
    if (!file.category_id) continue;

    const category = getCategoryById(file.category_id);
    if (!category || !category.target_path) continue;

    // Smart destination: try to extract context subfolder from source path
    const contextSubfolder = extractContextSubfolder(file.current_path, contextRules, category.slug);

    let destDir: string;
    if (contextSubfolder) {
      // Context-aware: Organized/Clients/LOC/  or  Organized/Projects/Clawdbot/src/
      destDir = path.join(organizedRoot, category.target_path, contextSubfolder);
    } else {
      // Flat fallback: Organized/Documents/  or  Organized/Media/
      destDir = path.join(organizedRoot, category.target_path);
    }

    const suggestedName = suggestBetterName(file.filename);
    const finalName = suggestedName || file.filename;
    const destPath = path.join(destDir, finalName).replace(/\\/g, '/');

    // Skip if already in the right place
    const currentNormalized = file.current_path.replace(/\\/g, '/');
    if (currentNormalized === destPath) continue;

    plan.push({
      fileId: file.id,
      currentPath: currentNormalized,
      destPath,
      currentName: file.filename,
      suggestedName,
      category: category.name,
      approved: false,
    });
  }

  return plan;
}

/**
 * Check disk space before executing a batch move.
 * Returns true if there's enough space on the destination drive.
 */
export async function checkDiskSpace(planItems: MovePlanItem[]): Promise<{ ok: boolean; needed: number; available: number }> {
  const totalSize = planItems.reduce((sum, item) => {
    try {
      const stat = fs.statSync(item.currentPath);
      return sum + stat.size;
    } catch {
      return sum;
    }
  }, 0);

  // Get free space on the destination drive
  const firstDest = planItems[0]?.destPath;
  if (!firstDest) return { ok: true, needed: 0, available: 0 };

  const destDrive = path.parse(firstDest).root || firstDest.substring(0, 3);
  try {
    const stats = await fs.promises.statfs(destDrive);
    const freeBytes = stats.bfree * stats.bsize;
    return {
      ok: freeBytes > totalSize * 1.1, // 10% margin
      needed: totalSize,
      available: freeBytes,
    };
  } catch {
    return { ok: true, needed: totalSize, available: 0 };
  }
}

export interface DriveBreakdown {
  drive: string;
  fileCount: number;
  totalBytes: number;
  freeBytes: number;
  isCrossDrive: boolean;
}

export interface PlanAnalysis {
  totalFiles: number;
  totalBytes: number;
  categoryBreakdown: Array<{ category: string; count: number; bytes: number }>;
  sourceDrives: DriveBreakdown[];
  destDrive: { drive: string; freeBytes: number };
  crossDriveCount: number;
  sameDriveCount: number;
  spaceOk: boolean;
  spaceNeeded: number;
}

/**
 * Analyze a move plan to give the user full visibility into what will happen.
 * Returns drive breakdown, cross-drive warnings, category sizes, and space check.
 */
export async function analyzePlan(planItems: MovePlanItem[]): Promise<PlanAnalysis> {
  if (planItems.length === 0) {
    return {
      totalFiles: 0, totalBytes: 0, categoryBreakdown: [],
      sourceDrives: [], destDrive: { drive: '', freeBytes: 0 },
      crossDriveCount: 0, sameDriveCount: 0, spaceOk: true, spaceNeeded: 0,
    };
  }

  // Calculate file sizes and group by category
  const categoryMap = new Map<string, { count: number; bytes: number }>();
  const sourceDriverMap = new Map<string, { count: number; bytes: number }>();
  let totalBytes = 0;

  for (const item of planItems) {
    let size = 0;
    try {
      size = fs.statSync(item.currentPath).size;
    } catch { /* file may not exist */ }

    totalBytes += size;

    // Category breakdown
    const cat = categoryMap.get(item.category) || { count: 0, bytes: 0 };
    cat.count++;
    cat.bytes += size;
    categoryMap.set(item.category, cat);

    // Source drive breakdown
    const srcDrive = (path.parse(item.currentPath).root || item.currentPath.substring(0, 3)).toUpperCase();
    const drv = sourceDriverMap.get(srcDrive) || { count: 0, bytes: 0 };
    drv.count++;
    drv.bytes += size;
    sourceDriverMap.set(srcDrive, drv);
  }

  // Destination drive
  const destRoot = (path.parse(planItems[0].destPath).root || planItems[0].destPath.substring(0, 3)).toUpperCase();
  let destFreeBytes = 0;
  try {
    const stats = await fs.promises.statfs(destRoot);
    destFreeBytes = stats.bfree * stats.bsize;
  } catch { /* ignore */ }

  // Cross-drive analysis
  let crossDriveCount = 0;
  let sameDriveCount = 0;
  for (const item of planItems) {
    const srcDrive = (path.parse(item.currentPath).root || item.currentPath.substring(0, 3)).toUpperCase();
    if (srcDrive === destRoot) {
      sameDriveCount++;
    } else {
      crossDriveCount++;
    }
  }

  // Source drive info with free space
  const sourceDrives: DriveBreakdown[] = [];
  for (const [drive, info] of sourceDriverMap) {
    let freeBytes = 0;
    try {
      const stats = await fs.promises.statfs(drive);
      freeBytes = stats.bfree * stats.bsize;
    } catch { /* ignore */ }
    sourceDrives.push({
      drive,
      fileCount: info.count,
      totalBytes: info.bytes,
      freeBytes,
      isCrossDrive: drive !== destRoot,
    });
  }

  // Space needed = only cross-drive files need extra space (same-drive = rename, no copy)
  const crossDriveBytes = planItems.reduce((sum, item) => {
    const srcDrive = (path.parse(item.currentPath).root || item.currentPath.substring(0, 3)).toUpperCase();
    if (srcDrive === destRoot) return sum;
    try {
      return sum + fs.statSync(item.currentPath).size;
    } catch {
      return sum;
    }
  }, 0);

  const spaceOk = destFreeBytes > crossDriveBytes * 1.1;

  // Category breakdown sorted by count desc
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, info]) => ({ category, count: info.count, bytes: info.bytes }))
    .sort((a, b) => b.count - a.count);

  return {
    totalFiles: planItems.length,
    totalBytes,
    categoryBreakdown,
    sourceDrives,
    destDrive: { drive: destRoot, freeBytes: destFreeBytes },
    crossDriveCount,
    sameDriveCount,
    spaceOk,
    spaceNeeded: crossDriveBytes,
  };
}
