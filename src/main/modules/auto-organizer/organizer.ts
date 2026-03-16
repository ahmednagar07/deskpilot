import path from 'path';
import fs from 'fs';
import os from 'os';
import * as fileRepo from '../../database/repositories/file-repo';
import * as settingsRepo from '../../database/repositories/settings-repo';
import { getCategoryById } from '../file-classifier/categories';
import { suggestBetterName } from './name-suggester';
import { MovePlanItem } from '../../../shared/types';

/**
 * Generate a move plan for all unorganized, classified files.
 * Each plan item maps: current path → destination path (based on category target_path).
 */
export function generateMovePlan(): MovePlanItem[] {
  const fallbackRoot = path.join(os.homedir(), 'Documents', 'Organized').replace(/\\/g, '/');
  const organizedRoot = settingsRepo.getSetting<string>('organized_root') || fallbackRoot;
  const files = fileRepo.getUnorganizedFiles();
  const plan: MovePlanItem[] = [];

  for (const file of files) {
    // Skip files without a category
    if (!file.category_id) continue;

    const category = getCategoryById(file.category_id);
    if (!category || !category.target_path) continue;

    const destDir = path.join(organizedRoot, category.target_path);
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
