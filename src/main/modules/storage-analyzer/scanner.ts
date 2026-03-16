import fs from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import { IpcChannels } from '../../../shared/ipc-channels';
import { isTempFile, isCacheDirectory, isNodeModules, LARGE_FILE_THRESHOLD } from './patterns';
import { getDirSize } from '../../utils/fs-helpers';
import * as scanRepo from '../../database/repositories/scan-repo';

const MAX_PATH_LENGTH = 250; // Windows MAX_PATH is 260, leave margin for safety

export interface ScanOptions {
  drives: string[];
  scanTemp?: boolean;
  scanCache?: boolean;
  scanNodeModules?: boolean;
  scanLargeFiles?: boolean;
  scanDuplicates?: boolean;
  largeFileThreshold?: number;
  maxDepth?: number;
}

export interface ScanResult {
  totalItems: number;
  totalReclaimableBytes: number;
  byType: Record<string, { count: number; totalSize: number }>;
}

let scanning = false;
let aborted = false;

export function isScanning(): boolean {
  return scanning;
}

export function abortScan(): void {
  aborted = true;
}

export async function runStorageScan(options: ScanOptions, senderWindow?: BrowserWindow): Promise<ScanResult> {
  if (scanning) throw new Error('Scan already in progress');

  scanning = true;
  aborted = false;

  const {
    drives,
    scanTemp = true,
    scanCache = true,
    scanNodeModules = true,
    scanLargeFiles = true,
    largeFileThreshold = LARGE_FILE_THRESHOLD,
    maxDepth = 8,
  } = options;

  const result: ScanResult = {
    totalItems: 0,
    totalReclaimableBytes: 0,
    byType: {},
  };

  // Local set to detect symlink loops — scoped to this scan, not module-level
  const visitedRealPaths = new Set<string>();

  function sendProgress(phase: string, current: number, total: number, currentPath?: string) {
    if (senderWindow && !senderWindow.isDestroyed()) {
      senderWindow.webContents.send(IpcChannels.STORAGE_SCAN_PROGRESS, {
        phase,
        current,
        total,
        currentPath,
      });
    }
  }

  function addResult(drivePath: string, scanType: string, itemPath: string, sizeBytes: number) {
    scanRepo.insertScanItem({
      drive_path: drivePath,
      scan_type: scanType as 'temp' | 'cache' | 'node_modules' | 'duplicates' | 'large_files',
      item_path: itemPath,
      size_bytes: sizeBytes,
    });

    result.totalItems++;
    result.totalReclaimableBytes += sizeBytes;

    if (!result.byType[scanType]) {
      result.byType[scanType] = { count: 0, totalSize: 0 };
    }
    result.byType[scanType].count++;
    result.byType[scanType].totalSize += sizeBytes;
  }

  try {
    // Clear previous results — inside try so scanning flag resets on failure
    scanRepo.clearScanResults();

    for (let driveIndex = 0; driveIndex < drives.length; driveIndex++) {
      if (aborted) break;
      const drive = drives[driveIndex];

      sendProgress('Scanning drive', driveIndex, drives.length, drive);

      await scanDirectory(
        drive,
        drive,
        0,
        maxDepth,
        {
          scanTemp,
          scanCache,
          scanNodeModules,
          scanLargeFiles,
          largeFileThreshold,
        },
        addResult,
        sendProgress,
        visitedRealPaths,
      );
    }

    sendProgress('Complete', 1, 1);
    return result;
  } finally {
    scanning = false;
  }
}

async function scanDirectory(
  rootDrive: string,
  dirPath: string,
  depth: number,
  maxDepth: number,
  options: {
    scanTemp: boolean;
    scanCache: boolean;
    scanNodeModules: boolean;
    scanLargeFiles: boolean;
    largeFileThreshold: number;
  },
  addResult: (drive: string, type: string, path: string, size: number) => void,
  sendProgress: (phase: string, current: number, total: number, currentPath?: string) => void,
  visitedRealPaths: Set<string>,
): Promise<void> {
  if (aborted || depth > maxDepth) return;

  // Skip paths that are too long for Windows
  if (dirPath.length > MAX_PATH_LENGTH) {
    console.warn(`[scanner] Skipping path exceeding ${MAX_PATH_LENGTH} chars: ${dirPath}`);
    return;
  }

  // Detect symlink loops by resolving the real path
  try {
    const realPath = await fs.promises.realpath(dirPath);
    if (visitedRealPaths.has(realPath)) {
      console.warn(`[scanner] Skipping symlink loop: ${dirPath} -> ${realPath}`);
      return;
    }
    visitedRealPaths.add(realPath);
  } catch {
    // If we can't resolve the real path, skip this directory
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'EPERM' || code === 'EACCES') {
      console.warn(`[scanner] Permission denied, skipping: ${dirPath}`);
    }
    return; // Skip inaccessible directories
  }

  // Check if this directory is a cache directory
  if (options.scanCache && isCacheDirectory(dirPath)) {
    const size = await getDirSize(dirPath);
    if (size > 0) {
      addResult(rootDrive, 'cache', dirPath, size);
    }
    return; // Don't recurse into cache dirs
  }

  for (const entry of entries) {
    if (aborted) return;

    const fullPath = path.join(dirPath, entry.name);

    // Skip files/directories whose paths are too long for Windows
    if (fullPath.length > MAX_PATH_LENGTH) {
      console.warn(`[scanner] Skipping path exceeding ${MAX_PATH_LENGTH} chars: ${fullPath}`);
      continue;
    }

    try {
      if (entry.isDirectory()) {
        // Check for node_modules
        if (options.scanNodeModules && isNodeModules(entry.name)) {
          sendProgress('Scanning node_modules', 0, 0, fullPath);
          const size = await getDirSize(fullPath);
          if (size > 1024 * 1024) { // Only report if > 1MB
            addResult(rootDrive, 'node_modules', fullPath, size);
          }
          continue; // Don't recurse into node_modules
        }

        // Skip system directories
        if (shouldSkipDirectory(entry.name)) continue;

        // Recurse
        await scanDirectory(rootDrive, fullPath, depth + 1, maxDepth, options, addResult, sendProgress, visitedRealPaths);
      } else if (entry.isFile()) {
        const stat = await fs.promises.stat(fullPath).catch(() => null);
        if (!stat) continue;

        // Check for temp files
        if (options.scanTemp && isTempFile(entry.name)) {
          addResult(rootDrive, 'temp', fullPath, stat.size);
          continue;
        }

        // Check for large files
        if (options.scanLargeFiles && stat.size > options.largeFileThreshold) {
          addResult(rootDrive, 'large_files', fullPath, stat.size);
        }
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'EPERM' || code === 'EACCES') {
        console.warn(`[scanner] Permission denied, skipping: ${fullPath}`);
      }
      // Skip files we can't access
    }
  }
}

const SKIP_DIRS = new Set([
  '$Recycle.Bin',
  '$WinREAgent',
  'System Volume Information',
  'Windows',
  'Program Files',
  'Program Files (x86)',
  'ProgramData',
  'Recovery',
  'MSOCache',
  '.git',
  '.svn',
  '__pycache__',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'target',
  'vendor',
  'venv',
  '.venv',
  'env',
]);

function shouldSkipDirectory(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith('$');
}
