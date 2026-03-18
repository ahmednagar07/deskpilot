import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { shell } from 'electron';
import * as fileRepo from '../../database/repositories/file-repo';
import * as moveLogRepo from '../../database/repositories/move-log-repo';
import { resolveCollision } from './name-suggester';
import { MovePlanItem } from '../../../shared/types';

export interface MoveProgress {
  current: number;
  total: number;
  currentFile: string;
  bytesProcessed: number;
  totalBytes: number;
}

export interface MoveOptions {
  /** 'move' = move file (delete source), 'copy' = copy only (keep source) */
  mode: 'move' | 'copy';
  /** How to handle files that already exist at destination */
  duplicates: 'skip' | 'overwrite' | 'rename';
}

export const DEFAULT_MOVE_OPTIONS: MoveOptions = {
  mode: 'move',
  duplicates: 'rename',
};

export interface ExecutionResult {
  succeeded: number;
  failed: number;
  skipped: number;
  sessionId: string;
  errors: Array<{ fileId: number; path: string; error: string }>;
  warnings: Array<{ fileId: number; path: string; warning: string }>;
  /** Breakdown by category for the results card */
  categoryBreakdown: Array<{ category: string; count: number }>;
  totalBytes: number;
  elapsedMs: number;
  mode: 'move' | 'copy';
}

/**
 * Execute approved move plan items.
 * - Same-drive: fs.renameSync (atomic)
 * - Cross-drive: copy → verify size → trash source
 * - Every move is logged for undo
 *
 * Key safety: if copy succeeds but trash fails, the move still counts as
 * succeeded (file IS at destination). The source is left in place and the
 * user is warned.
 */
export async function executePlan(
  approvedItems: MovePlanItem[],
  onProgress?: (progress: MoveProgress) => void,
  options: MoveOptions = DEFAULT_MOVE_OPTIONS,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const sessionId = crypto.randomUUID();
  const result: ExecutionResult = {
    succeeded: 0,
    failed: 0,
    skipped: 0,
    sessionId,
    errors: [],
    warnings: [],
    categoryBreakdown: [],
    totalBytes: 0,
    elapsedMs: 0,
    mode: options.mode,
  };

  // Pre-check: verify all source files still exist before starting the batch
  for (const item of approvedItems) {
    if (!fs.existsSync(item.currentPath)) {
      result.failed++;
      result.errors.push({
        fileId: item.fileId,
        path: item.currentPath,
        error: `Source file no longer exists`,
      });
    }
  }

  // If any files are missing, only process the ones that still exist
  const validItems = approvedItems.filter((item) => fs.existsSync(item.currentPath));

  // Compute total bytes for progress estimation
  let totalBytes = 0;
  const itemSizes = new Map<number, number>();
  for (const item of validItems) {
    try {
      const stat = fs.statSync(item.currentPath);
      itemSizes.set(item.fileId, stat.size);
      totalBytes += stat.size;
    } catch {
      itemSizes.set(item.fileId, 0);
    }
  }

  let bytesProcessed = 0;
  let processedCount = 0;
  const categoryCountMap = new Map<string, number>();

  for (const item of validItems) {
    try {
      // Handle duplicate files at destination
      const destExists = fs.existsSync(item.destPath);
      let finalDest: string;

      if (destExists) {
        switch (options.duplicates) {
          case 'skip':
            result.skipped++;
            processedCount++;
            bytesProcessed += itemSizes.get(item.fileId) || 0;
            onProgress?.({ current: processedCount, total: validItems.length, currentFile: item.currentName, bytesProcessed, totalBytes });
            continue;
          case 'overwrite':
            finalDest = item.destPath;
            // Remove existing file before overwriting
            try { fs.unlinkSync(finalDest); } catch { /* ignore */ }
            break;
          case 'rename':
          default:
            finalDest = resolveCollision(item.destPath, (p) => fs.existsSync(p));
            break;
        }
      } else {
        finalDest = item.destPath;
      }

      // Ensure destination directory exists
      const destDir = path.dirname(finalDest);
      fs.mkdirSync(destDir, { recursive: true });

      const sourceDrive = path.parse(item.currentPath).root;
      const destDrive = path.parse(finalDest).root;
      const sameDrive = sourceDrive.toLowerCase() === destDrive.toLowerCase();

      if (options.mode === 'copy') {
        // Copy-only mode: never delete source
        await fs.promises.copyFile(item.currentPath, finalDest);
      } else if (sameDrive) {
        // Atomic rename on same drive
        fs.renameSync(item.currentPath, finalDest);
      } else {
        // Cross-drive: copy → verify → trash (with resilient error handling)
        await crossDriveMove(item.currentPath, finalDest, (warning) => {
          result.warnings.push({ fileId: item.fileId, path: item.currentPath, warning });
        });
      }

      // Log the move for undo
      moveLogRepo.insertMoveLog({
        file_id: item.fileId,
        source_path: item.currentPath,
        dest_path: finalDest.replace(/\\/g, '/'),
        old_filename: item.currentName,
        new_filename: path.basename(finalDest),
        session_id: sessionId,
        operation: options.mode === 'copy' ? 'copy' : (item.currentName !== path.basename(finalDest) ? 'rename' : 'move'),
      });

      // Update tracked file
      fileRepo.updateFilePath(item.fileId, finalDest.replace(/\\/g, '/'), path.basename(finalDest));

      result.succeeded++;

      // Track category breakdown
      const catCount = categoryCountMap.get(item.category) || 0;
      categoryCountMap.set(item.category, catCount + 1);
    } catch (err: unknown) {
      result.failed++;
      result.errors.push({
        fileId: item.fileId,
        path: item.currentPath,
        error: friendlyMoveError(err, item.currentPath),
      });
    }

    // Report progress
    const fileSize = itemSizes.get(item.fileId) || 0;
    bytesProcessed += fileSize;
    processedCount++;
    onProgress?.({
      current: processedCount,
      total: validItems.length,
      currentFile: item.currentName,
      bytesProcessed,
      totalBytes,
    });
  }

  // Build category breakdown for results card
  result.categoryBreakdown = Array.from(categoryCountMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  result.totalBytes = bytesProcessed;
  result.elapsedMs = Date.now() - startTime;

  return result;
}

/**
 * Map system error codes to user-friendly messages.
 */
function friendlyMoveError(err: unknown, filePath: string): string {
  if (err instanceof Error && 'code' in err) {
    const code = (err as NodeJS.ErrnoException).code;
    switch (code) {
      case 'EBUSY':
        return `File is in use by another program: ${path.basename(filePath)}`;
      case 'EPERM':
      case 'EACCES':
        return `Permission denied: file may be read-only or require admin access`;
      case 'ENAMETOOLONG':
        return `Path too long: Windows has a 260 character limit`;
      case 'ENOSPC':
        return `Not enough disk space on destination drive`;
      case 'ENOENT':
        return `File not found — it may have been moved or deleted`;
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Cross-drive move: copy → verify size matches → trash source.
 *
 * CRITICAL FIX: if the copy succeeds but trashing the source fails,
 * we do NOT throw — the file IS at the destination. We report a warning
 * instead, so the move still counts as succeeded.
 */
async function crossDriveMove(
  source: string,
  dest: string,
  onWarning?: (warning: string) => void,
): Promise<void> {
  // Step 1: Copy — this MUST succeed or we throw
  try {
    await fs.promises.copyFile(source, dest);
  } catch (copyErr) {
    // Clean up partial destination file if copy failed mid-write
    await fs.promises.unlink(dest).catch(() => {});
    throw copyErr;
  }

  // Step 2: Verify — size must match
  const srcStat = await fs.promises.stat(source);
  const dstStat = await fs.promises.stat(dest);

  if (srcStat.size !== dstStat.size) {
    await fs.promises.unlink(dest);
    throw new Error(`Size mismatch after copy: ${srcStat.size} vs ${dstStat.size}`);
  }

  // Step 3: Trash source — if this fails, the file is still at the destination
  // so we warn instead of throwing
  try {
    await shell.trashItem(source);
  } catch (trashErr) {
    const msg = trashErr instanceof Error ? trashErr.message : String(trashErr);
    onWarning?.(`File copied successfully but source could not be trashed: ${path.basename(source)} (${msg})`);
    // Do NOT throw — the file IS at the destination, move is successful
  }
}
