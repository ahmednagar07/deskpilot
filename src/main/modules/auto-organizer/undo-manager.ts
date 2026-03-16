import fs from 'fs';
import path from 'path';
import * as moveLogRepo from '../../database/repositories/move-log-repo';
import * as fileRepo from '../../database/repositories/file-repo';

export interface UndoResult {
  succeeded: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}

/**
 * Undo a single move log entry.
 */
export async function undoMove(moveLogId: number): Promise<UndoResult> {
  const entry = moveLogRepo.getMoveLogById(moveLogId);
  if (!entry) {
    return { succeeded: 0, failed: 1, errors: [{ id: moveLogId, error: 'Move log entry not found' }] };
  }

  return undoEntries([entry]);
}

/**
 * Undo all moves in a session (batch undo).
 */
export async function undoSession(sessionId: string): Promise<UndoResult> {
  const entries = moveLogRepo.getUndoableEntries(sessionId);
  if (entries.length === 0) {
    return { succeeded: 0, failed: 0, errors: [] };
  }

  return undoEntries(entries);
}

/**
 * Get undo history — recent sessions with their move counts.
 */
export function getUndoHistory(limit: number = 20) {
  return moveLogRepo.getRecentSessions(limit);
}

/**
 * Get details for a specific session.
 */
export function getSessionDetails(sessionId: string) {
  return moveLogRepo.getMoveLogBySession(sessionId);
}

// ── Internal ──────────────────────────────────

async function undoEntries(entries: Array<{
  id: number;
  file_id: number;
  source_path: string;
  dest_path: string;
  old_filename: string | null;
}>): Promise<UndoResult> {
  const result: UndoResult = { succeeded: 0, failed: 0, errors: [] };

  for (const entry of entries) {
    try {
      // Move file back from dest to source
      if (!fs.existsSync(entry.dest_path)) {
        // File no longer exists at destination — report as failure, not success
        console.warn(`[undo] File no longer exists at destination: ${entry.dest_path}`);
        result.failed++;
        result.errors.push({
          id: entry.id,
          error: `File no longer exists at ${path.basename(entry.dest_path)} — it may have been moved or deleted`,
        });
        continue;
      }

      // Ensure source directory exists (recreate if it was deleted)
      const sourceDir = path.dirname(entry.source_path);
      if (!fs.existsSync(sourceDir)) {
        console.info(`[undo] Recreating deleted directory: ${sourceDir}`);
      }
      fs.mkdirSync(sourceDir, { recursive: true });

      const sourceDrive = path.parse(entry.source_path).root;
      const destDrive = path.parse(entry.dest_path).root;

      if (sourceDrive.toLowerCase() === destDrive.toLowerCase()) {
        fs.renameSync(entry.dest_path, entry.source_path);
      } else {
        // Cross-drive: copy then verify then delete
        try {
          await fs.promises.copyFile(entry.dest_path, entry.source_path);
          const srcStat = await fs.promises.stat(entry.source_path);
          const dstStat = await fs.promises.stat(entry.dest_path);
          if (srcStat.size === dstStat.size) {
            await fs.promises.unlink(entry.dest_path);
          } else {
            // Size mismatch — remove partial copy, keep original
            await fs.promises.unlink(entry.source_path).catch(() => {});
            throw new Error('Copy verification failed: size mismatch');
          }
        } catch (copyErr) {
          // Clean up partial copy at source if it exists
          await fs.promises.unlink(entry.source_path).catch(() => {});
          throw copyErr;
        }
      }

      // Update tracked file back to original path
      const originalFilename = entry.old_filename || path.basename(entry.source_path);
      fileRepo.updateFilePath(entry.file_id, entry.source_path, originalFilename);

      // Mark is_organized back to 0
      const db = (await import('../../database/connection')).getDatabase();
      db.prepare('UPDATE tracked_files SET is_organized = 0 WHERE id = ?').run(entry.file_id);

      moveLogRepo.markUndone(entry.id);
      result.succeeded++;
    } catch (err: unknown) {
      result.failed++;
      let message: string;
      if (err instanceof Error && 'code' in err) {
        const code = (err as NodeJS.ErrnoException).code;
        switch (code) {
          case 'EBUSY':
            message = `File is in use by another program: ${path.basename(entry.dest_path)}`;
            break;
          case 'EPERM':
          case 'EACCES':
            message = `Permission denied: file may be read-only or require admin access`;
            break;
          case 'ENOENT':
            message = `File not found — it may have been moved or deleted since the undo was requested`;
            break;
          default:
            message = err.message;
        }
      } else {
        message = err instanceof Error ? err.message : String(err);
      }
      result.errors.push({
        id: entry.id,
        error: message,
      });
    }
  }

  return result;
}
