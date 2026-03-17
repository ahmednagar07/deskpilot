import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { shell } from 'electron';
import * as fileRepo from '../../database/repositories/file-repo';
import * as moveLogRepo from '../../database/repositories/move-log-repo';
import { resolveCollision } from './name-suggester';
import { MovePlanItem } from '../../../shared/types';

export interface ExecutionResult {
  succeeded: number;
  failed: number;
  sessionId: string;
  errors: Array<{ fileId: number; path: string; error: string }>;
}

/**
 * Execute approved move plan items.
 * - Same-drive: fs.renameSync (atomic)
 * - Cross-drive: copy → verify size → delete source
 * - Every move is logged for undo
 */
export async function executePlan(approvedItems: MovePlanItem[]): Promise<ExecutionResult> {
  const sessionId = crypto.randomUUID();
  const result: ExecutionResult = {
    succeeded: 0,
    failed: 0,
    sessionId,
    errors: [],
  };

  // Pre-check: verify all source files still exist before starting the batch
  for (const item of approvedItems) {
    if (!fs.existsSync(item.currentPath)) {
      result.failed++;
      result.errors.push({
        fileId: item.fileId,
        path: item.currentPath,
        error: `Source file no longer exists (may have been moved or deleted since the plan was generated)`,
      });
    }
  }

  // If any files are missing, only process the ones that still exist
  const validItems = approvedItems.filter((item) => fs.existsSync(item.currentPath));

  for (const item of validItems) {
    try {
      // Resolve destination collisions
      const finalDest = resolveCollision(item.destPath, (p) => fs.existsSync(p));

      // Ensure destination directory exists
      const destDir = path.dirname(finalDest);
      fs.mkdirSync(destDir, { recursive: true });

      const sourceDrive = path.parse(item.currentPath).root;
      const destDrive = path.parse(finalDest).root;
      const sameDrive = sourceDrive.toLowerCase() === destDrive.toLowerCase();

      if (sameDrive) {
        // Atomic rename on same drive
        fs.renameSync(item.currentPath, finalDest);
      } else {
        // Cross-drive: copy, verify, delete
        await crossDriveMove(item.currentPath, finalDest);
      }

      // Log the move for undo
      moveLogRepo.insertMoveLog({
        file_id: item.fileId,
        source_path: item.currentPath,
        dest_path: finalDest.replace(/\\/g, '/'),
        old_filename: item.currentName,
        new_filename: path.basename(finalDest),
        session_id: sessionId,
        operation: item.currentName !== path.basename(finalDest) ? 'rename' : 'move',
      });

      // Update tracked file
      fileRepo.updateFilePath(item.fileId, finalDest.replace(/\\/g, '/'), path.basename(finalDest));

      result.succeeded++;
    } catch (err: unknown) {
      result.failed++;
      result.errors.push({
        fileId: item.fileId,
        path: item.currentPath,
        error: friendlyMoveError(err, item.currentPath),
      });
    }
  }

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
 * Cross-drive move: copy → verify size matches → delete source.
 */
async function crossDriveMove(source: string, dest: string): Promise<void> {
  try {
    await fs.promises.copyFile(source, dest);
  } catch (copyErr) {
    // Clean up partial destination file if copy failed mid-write
    await fs.promises.unlink(dest).catch(() => {});
    throw copyErr;
  }

  // Verify the copy
  const srcStat = await fs.promises.stat(source);
  const dstStat = await fs.promises.stat(dest);

  if (srcStat.size !== dstStat.size) {
    // Cleanup failed copy
    await fs.promises.unlink(dest);
    throw new Error(`Size mismatch after copy: ${srcStat.size} vs ${dstStat.size}`);
  }

  // Send source to Recycle Bin after verified copy (recoverable, not permanent delete)
  await shell.trashItem(source);
}
