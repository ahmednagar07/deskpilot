import fs from 'fs';
import { hashFile } from '../../utils/fs-helpers';

export interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
}

/**
 * 3-phase duplicate detection:
 * 1. Group files by size (same size = potential duplicate)
 * 2. Partial hash (first 64KB) to narrow down
 * 3. Full hash for final confirmation
 *
 * This avoids hashing every file, which would be extremely slow on large drives.
 */
export async function findDuplicates(
  filePaths: Array<{ path: string; size: number }>,
  onProgress?: (phase: string, current: number, total: number) => void,
): Promise<DuplicateGroup[]> {
  // Phase 1: Group by file size
  onProgress?.('Grouping by size', 0, filePaths.length);

  const sizeGroups = new Map<number, string[]>();
  for (const file of filePaths) {
    if (file.size < 1024) continue; // Skip files smaller than 1KB

    const existing = sizeGroups.get(file.size);
    if (existing) {
      existing.push(file.path);
    } else {
      sizeGroups.set(file.size, [file.path]);
    }
  }

  // Keep only groups with 2+ files (potential duplicates)
  const candidates: Array<{ size: number; files: string[] }> = [];
  for (const [size, files] of sizeGroups) {
    if (files.length >= 2) {
      candidates.push({ size, files });
    }
  }

  if (candidates.length === 0) return [];

  // Phase 2: Partial hash (first 64KB)
  const PARTIAL_HASH_BYTES = 64 * 1024;
  const partialHashGroups = new Map<string, { size: number; files: string[] }>();
  let processed = 0;
  const totalCandidateFiles = candidates.reduce((sum, g) => sum + g.files.length, 0);

  for (const group of candidates) {
    for (const filePath of group.files) {
      onProgress?.('Partial hashing', processed++, totalCandidateFiles);

      const hash = await hashFile(filePath, PARTIAL_HASH_BYTES);
      if (!hash) continue;

      const key = `${group.size}-${hash}`;
      const existing = partialHashGroups.get(key);
      if (existing) {
        existing.files.push(filePath);
      } else {
        partialHashGroups.set(key, { size: group.size, files: [filePath] });
      }
    }
  }

  // Keep only groups with 2+ files
  const hashCandidates = [...partialHashGroups.values()].filter(g => g.files.length >= 2);

  if (hashCandidates.length === 0) return [];

  // Phase 3: Full hash for confirmation
  const duplicates: DuplicateGroup[] = [];
  const fullHashGroups = new Map<string, { size: number; files: string[] }>();
  processed = 0;
  const totalHashFiles = hashCandidates.reduce((sum, g) => sum + g.files.length, 0);

  for (const group of hashCandidates) {
    for (const filePath of group.files) {
      onProgress?.('Full hashing', processed++, totalHashFiles);

      const hash = await hashFile(filePath);
      if (!hash) continue;

      const existing = fullHashGroups.get(hash);
      if (existing) {
        existing.files.push(filePath);
      } else {
        fullHashGroups.set(hash, { size: group.size, files: [filePath] });
      }
    }
  }

  for (const [hash, group] of fullHashGroups) {
    if (group.files.length >= 2) {
      duplicates.push({
        hash,
        size: group.size,
        files: group.files,
      });
    }
  }

  return duplicates;
}
