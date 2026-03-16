import { shell } from 'electron';
import fs from 'fs';
import * as scanRepo from '../../database/repositories/scan-repo';

export interface CleanupResult {
  succeeded: number;
  failed: number;
  freedBytes: number;
  errors: Array<{ path: string; error: string }>;
}

/**
 * Clean up approved storage scan items.
 * Uses shell.trashItem() for files (sends to Recycle Bin).
 * For directories (node_modules, cache), removes recursively.
 */
export async function cleanupApprovedItems(itemIds: number[]): Promise<CleanupResult> {
  const result: CleanupResult = {
    succeeded: 0,
    failed: 0,
    freedBytes: 0,
    errors: [],
  };

  // Mark items as approved
  scanRepo.approveScanItems(itemIds);

  // Get the approved items
  const allResults = scanRepo.getScanResults();
  const items = allResults.filter(item => itemIds.includes(item.id));

  for (const item of items) {
    try {
      const exists = fs.existsSync(item.item_path);
      if (!exists) {
        // Already gone — mark as cleaned
        scanRepo.markCleaned([item.id]);
        result.succeeded++;
        result.freedBytes += item.size_bytes;
        continue;
      }

      // Send everything to Recycle Bin — never permanently delete
      await shell.trashItem(item.item_path);

      scanRepo.markCleaned([item.id]);
      result.succeeded++;
      result.freedBytes += item.size_bytes;
    } catch (err) {
      result.failed++;
      result.errors.push({
        path: item.item_path,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Get drive space info using Node.js fs.statfs (Node 18+).
 */
export async function getDriveInfo(drivePath: string): Promise<{ totalBytes: number; freeBytes: number; usedBytes: number } | null> {
  try {
    const stats = await fs.promises.statfs(drivePath);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    return {
      totalBytes,
      freeBytes,
      usedBytes: totalBytes - freeBytes,
    };
  } catch {
    return null;
  }
}
