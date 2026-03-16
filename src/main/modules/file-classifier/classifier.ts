import fs from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import { IpcChannels } from '../../../shared/ipc-channels';
import { TrackedFile } from '../../../shared/types';
import * as fileRepo from '../../database/repositories/file-repo';
import * as scanRepo from '../../database/repositories/scan-repo';
import { classifyByRules } from './rule-engine';
import { classifyWithGemini, hasGeminiApiKey, ReviewItem } from './gemini-client';
import { getCategoryBySlug, getCategoryById } from './categories';

// Directories to skip during file discovery
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '__pycache__',
  'dist', 'build', '.next', '.nuxt', '.cache',
  '$Recycle.Bin', 'System Volume Information',
  'AppData', 'ProgramData',
]);

// Extensions to skip (system/binary files)
const SKIP_EXTENSIONS = new Set([
  '.dll', '.sys', '.dat', '.log', '.tmp', '.bak',
  '.lnk', '.url', '.ini', '.db', '.sqlite',
]);

const MAX_DEPTH = 5;

let abortFlag = false;
let scanningFlag = false;

// In-memory review queue — persists until user resolves or next scan
let pendingReviewItems: ReviewItem[] = [];

export function isClassifying(): boolean {
  return scanningFlag;
}

export function abortClassification(): void {
  abortFlag = true;
}

export function getPendingReviewItems(): ReviewItem[] {
  return pendingReviewItems;
}

export function clearReviewItems(): void {
  pendingReviewItems = [];
}

export interface ClassifierOptions {
  folderPaths: string[];
  useGemini: boolean;
  maxDepth?: number;
}

export interface ClassifierResult {
  totalDiscovered: number;
  ruleClassified: number;
  geminiClassified: number;
  unclassified: number;
  needsReview: number;
  errors: string[];
}

/**
 * Main classification pipeline:
 * 1. Discover files in managed folders
 * 2. Classify with rule engine (instant, confidence 1.0)
 * 3. Send remaining to Gemini (if enabled and API key set)
 *    - High confidence → auto-classified
 *    - Low confidence → review queue (AI asks user for help)
 * 4. Store results in tracked_files table
 */
export async function runClassification(
  options: ClassifierOptions,
  senderWindow?: BrowserWindow,
): Promise<ClassifierResult> {
  scanningFlag = true;
  abortFlag = false;
  pendingReviewItems = []; // Clear previous review queue

  const result: ClassifierResult = {
    totalDiscovered: 0,
    ruleClassified: 0,
    geminiClassified: 0,
    unclassified: 0,
    needsReview: 0,
    errors: [],
  };

  try {
    // Phase 1: Discover files
    sendProgress(senderWindow, 'Discovering files...', 0, 0);
    const filePaths: string[] = [];

    for (const folderPath of options.folderPaths) {
      if (abortFlag) break;
      const discovered = discoverFiles(folderPath, options.maxDepth ?? MAX_DEPTH);
      filePaths.push(...discovered);
    }

    result.totalDiscovered = filePaths.length;
    if (filePaths.length === 0) {
      return result;
    }

    // Phase 2: Rule-based classification
    sendProgress(senderWindow, 'Classifying with rules...', 0, filePaths.length);
    const unclassified: string[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      if (abortFlag) break;
      const fp = filePaths[i];

      // Skip if already tracked
      if (fileRepo.fileExists(fp.replace(/\\/g, '/'))) {
        continue;
      }

      const ruleMatch = classifyByRules(fp);

      if (ruleMatch) {
        insertTrackedFile(fp, ruleMatch.categoryId, 'rule', 1.0);
        result.ruleClassified++;
      } else {
        unclassified.push(fp);
      }

      if (i % 50 === 0) {
        sendProgress(senderWindow, 'Classifying with rules...', i, filePaths.length, fp);
      }
    }

    // Phase 3: Gemini classification for unmatched files
    if (unclassified.length > 0 && options.useGemini && hasGeminiApiKey()) {
      sendProgress(senderWindow, 'AI is analyzing files...', 0, unclassified.length);

      try {
        const geminiResult = await classifyWithGemini(unclassified);

        // Process confident classifications
        const classifiedPaths = new Set<string>();
        for (const gr of geminiResult.classified) {
          if (abortFlag) break;

          const category = getCategoryBySlug(gr.categorySlug);
          if (category) {
            insertTrackedFile(gr.filePath, category.id, 'gemini', gr.confidence);
            result.geminiClassified++;
            classifiedPaths.add(gr.filePath);
          }
        }

        // Store review items for user interaction
        pendingReviewItems = geminiResult.needsReview;
        result.needsReview = geminiResult.needsReview.length;

        // Track review items as unclassified in DB (user will resolve them)
        for (const ri of geminiResult.needsReview) {
          classifiedPaths.add(ri.filePath);
          // Insert with best guess but low confidence — user will override
          const bestCat = getCategoryBySlug(ri.bestGuess);
          insertTrackedFile(
            ri.filePath,
            bestCat?.id ?? null,
            'gemini',
            ri.bestGuessConfidence,
          );
        }

        // Insert remaining truly unclassified files
        for (const fp of unclassified) {
          if (!classifiedPaths.has(fp)) {
            insertTrackedFile(fp, null, null, null);
            result.unclassified++;
          }
        }

        // Review items are fetched via scanner:get-review-items poll after scan completes
      } catch (err) {
        result.errors.push(`Gemini: ${err instanceof Error ? err.message : String(err)}`);
        // Insert all as unclassified
        for (const fp of unclassified) {
          insertTrackedFile(fp, null, null, null);
          result.unclassified++;
        }
      }
    } else {
      // No Gemini — insert all remaining as unclassified
      for (const fp of unclassified) {
        insertTrackedFile(fp, null, null, null);
        result.unclassified++;
      }
    }

    sendProgress(senderWindow, 'Done', result.totalDiscovered, result.totalDiscovered);
  } finally {
    scanningFlag = false;
    abortFlag = false;
  }

  return result;
}

/**
 * Resolve a review item — user chose a category.
 */
export function resolveReviewItem(filePath: string, categorySlug: string): boolean {
  const category = getCategoryBySlug(categorySlug);
  if (!category) return false;

  const normalizedPath = filePath.replace(/\\/g, '/');
  const file = fileRepo.getFileByPath(normalizedPath);
  if (!file) return false;

  fileRepo.updateFileCategory(file.id, category.id, 'manual', 1.0);

  // Remove from pending queue
  pendingReviewItems = pendingReviewItems.filter(ri => ri.filePath !== filePath);
  return true;
}

/**
 * Get all classified files with their category info for the UI.
 */
export function getClassifiedFiles(): Array<TrackedFile & { category_name?: string; category_slug?: string; category_color?: string }> {
  const files = fileRepo.getUnorganizedFiles();
  return files.map(f => {
    const cat = f.category_id ? getCategoryById(f.category_id) : null;
    return {
      ...f,
      category_name: cat?.name,
      category_slug: cat?.slug,
      category_color: cat?.color,
    };
  });
}

// ── Helpers ──────────────────────────────────────

function discoverFiles(dirPath: string, maxDepth: number, depth = 0): string[] {
  const results: string[] = [];

  if (depth > maxDepth) return results;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (abortFlag) break;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        results.push(...discoverFiles(fullPath, maxDepth, depth + 1));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SKIP_EXTENSIONS.has(ext) && !entry.name.startsWith('~$')) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function insertTrackedFile(
  filePath: string,
  categoryId: number | null,
  method: 'rule' | 'gemini' | 'manual' | null,
  confidence: number | null,
): void {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Don't insert duplicates
  if (fileRepo.fileExists(normalizedPath)) return;

  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase() || null;

  let sizeBytes = 0;
  let modifiedAt: string | null = null;
  try {
    const stat = fs.statSync(filePath);
    sizeBytes = stat.size;
    modifiedAt = stat.mtime.toISOString();
  } catch {
    // File may have been deleted between discovery and now
  }

  fileRepo.insertFile({
    original_path: normalizedPath,
    current_path: normalizedPath,
    filename,
    extension: ext,
    size_bytes: sizeBytes,
    hash_md5: null,
    category_id: categoryId,
    classification_method: method,
    classification_confidence: confidence,
    is_organized: false,
    modified_at: modifiedAt,
  });
}

function sendProgress(
  window: BrowserWindow | undefined,
  phase: string,
  current: number,
  total: number,
  currentPath?: string,
): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(IpcChannels.SCANNER_PROGRESS, {
      phase,
      current,
      total,
      currentPath,
    });
  }
}
