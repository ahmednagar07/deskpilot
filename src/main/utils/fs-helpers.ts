import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  isDirectory: boolean;
}

export async function getFileInfo(filePath: string): Promise<FileInfo | null> {
  try {
    const stat = await fs.promises.stat(filePath);
    const parsed = path.parse(filePath);
    return {
      path: filePath,
      name: parsed.base,
      extension: parsed.ext.toLowerCase(),
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      isDirectory: stat.isDirectory(),
    };
  } catch {
    return null;
  }
}

export function getFileInfoSync(filePath: string): FileInfo | null {
  try {
    const stat = fs.statSync(filePath);
    const parsed = path.parse(filePath);
    return {
      path: filePath,
      name: parsed.base,
      extension: parsed.ext.toLowerCase(),
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      isDirectory: stat.isDirectory(),
    };
  } catch {
    return null;
  }
}

/**
 * Compute MD5 hash of a file. Optionally only hash the first N bytes (for quick comparison).
 */
export async function hashFile(filePath: string, maxBytes?: number): Promise<string | null> {
  try {
    const hash = crypto.createHash('md5');

    if (maxBytes) {
      const fd = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(maxBytes);
      const { bytesRead } = await fd.read(buffer, 0, maxBytes, 0);
      await fd.close();
      hash.update(buffer.subarray(0, bytesRead));
    } else {
      const stream = fs.createReadStream(filePath);
      for await (const chunk of stream) {
        hash.update(chunk);
      }
    }

    return hash.digest('hex');
  } catch {
    return null;
  }
}

/**
 * Get total size of a directory recursively.
 */
export async function getDirSize(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await getDirSize(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          total += stat.size;
        } catch {
          // Skip inaccessible files
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return total;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}
