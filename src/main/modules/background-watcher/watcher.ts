import { watch, type FSWatcher } from 'chokidar';
import path from 'path';
import { Notification, BrowserWindow } from 'electron';
import * as scanRepo from '../../database/repositories/scan-repo';
import * as fileRepo from '../../database/repositories/file-repo';
import { classifyByRules } from '../file-classifier/rule-engine';
import { getCategoryById } from '../file-classifier/categories';

let watchers: Map<string, FSWatcher> = new Map();
let newFileQueue: Array<{ filePath: string; addedAt: number }> = [];
let processTimer: ReturnType<typeof setInterval> | null = null;

const NOTIFICATION_DELAY_MS = 30 * 1000; // 30 seconds delay before notifying
const SKIP_EXTENSIONS = new Set(['.tmp', '.crdownload', '.part', '.lock', '.log']);

/**
 * Start watching all active managed folders.
 */
export function startWatching(): void {
  stopWatching();

  const folders = scanRepo.getManagedFolders();
  const activeFolders = folders.filter(f => f.is_active && f.watch_mode !== 'ignore');

  for (const folder of activeFolders) {
    try {
      const watcher = watch(folder.path, {
        depth: 3,
        ignoreInitial: true,
        ignored: [
          /(^|[\/\\])\../,        // dotfiles
          /node_modules/,
          /\.git/,
          /\$Recycle\.Bin/,
        ],
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 500,
        },
      });

      watcher.on('add', (filePath) => onNewFile(filePath, folder.watch_mode as string));
      watcher.on('error', (err) => console.error(`[Watcher] Error on ${folder.path}:`, err));

      watchers.set(folder.path, watcher);
      console.log(`[Watcher] Watching: ${folder.path}`);
    } catch (err) {
      console.error(`[Watcher] Failed to watch ${folder.path}:`, err);
    }
  }

  // Start the queue processor
  if (!processTimer) {
    processTimer = setInterval(processNewFileQueue, 10000);
  }
}

/**
 * Stop all watchers.
 */
export function stopWatching(): void {
  for (const [, watcher] of watchers) {
    watcher.close();
  }
  watchers.clear();

  if (processTimer) {
    clearInterval(processTimer);
    processTimer = null;
  }
}

/**
 * Get count of watched folders.
 */
export function getWatchedFolderCount(): number {
  return watchers.size;
}

// ── Internal ──────────────────────────────────

function onNewFile(filePath: string, watchMode: string): void {
  const ext = path.extname(filePath).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return;

  newFileQueue.push({ filePath, addedAt: Date.now() });
}

function processNewFileQueue(): void {
  const now = Date.now();
  const ready = newFileQueue.filter(item => now - item.addedAt >= NOTIFICATION_DELAY_MS);
  newFileQueue = newFileQueue.filter(item => now - item.addedAt < NOTIFICATION_DELAY_MS);

  for (const item of ready) {
    processNewFile(item.filePath);
  }
}

function processNewFile(filePath: string): void {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Skip if already tracked
  if (fileRepo.fileExists(normalizedPath)) return;

  // Try rule-based classification
  const ruleMatch = classifyByRules(filePath);
  const category = ruleMatch ? getCategoryById(ruleMatch.categoryId) : null;

  // Show notification
  const filename = path.basename(filePath);
  const notification = new Notification({
    title: 'New file detected',
    body: category
      ? `"${filename}" → ${category.name}`
      : `"${filename}" — needs classification`,
    silent: true,
  });

  notification.on('click', () => {
    // Focus the main window
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows[0];
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  notification.show();
}
