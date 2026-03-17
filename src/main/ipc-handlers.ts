import { ipcMain, app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { IpcChannels } from '../shared/ipc-channels';
import * as settingsRepo from './database/repositories/settings-repo';
import * as categoryRepo from './database/repositories/category-repo';
import * as fileRepo from './database/repositories/file-repo';
import * as scanRepo from './database/repositories/scan-repo';
import * as moveLogRepo from './database/repositories/move-log-repo';
import { runStorageScan, abortScan, isScanning } from './modules/storage-analyzer/scanner';
import { cleanupApprovedItems, getDriveInfo } from './modules/storage-analyzer/cleaner';
import { runClassification, isClassifying, abortClassification, getClassifiedFiles, getPendingReviewItems, resolveReviewItem } from './modules/file-classifier/classifier';
import { setGeminiApiKey, hasGeminiApiKey } from './modules/file-classifier/gemini-client';
import { generateMovePlan, checkDiskSpace, analyzePlan } from './modules/auto-organizer/organizer';
import { executePlan } from './modules/auto-organizer/move-executor';
import { undoMove, undoSession, getUndoHistory, getSessionDetails } from './modules/auto-organizer/undo-manager';
import { MovePlanItem } from '../shared/types';
import { searchFiles, rebuildIndex } from './modules/quick-search/searcher';
import { getWatchedFolderCount, startWatching } from './modules/background-watcher/watcher';
import { findDuplicates } from './modules/storage-analyzer/duplicate-finder';
import { getAllFilesWithSize } from './database/repositories/file-repo';
import { checkForUpdates, downloadUpdate, installUpdate } from './updater';
import { getAutoScanInterval, setAutoScanInterval, runAutoScan } from './modules/background-watcher/auto-scan';
import { suggestBetterName, resolveCollision } from './modules/auto-organizer/name-suggester';

/**
 * Validate that a file path is within a managed folder (or tracked by the app).
 * Prevents arbitrary file system access from the renderer.
 */
function isPathInManagedScope(filePath: string): boolean {
  const normalized = path.resolve(filePath).toLowerCase();
  const folders = scanRepo.getManagedFolders();
  const organizedRoot = settingsRepo.getSetting('organized_root') as string | null;

  const allowedRoots = folders.map(f => path.resolve(f.path).toLowerCase());
  if (organizedRoot) {
    allowedRoots.push(path.resolve(organizedRoot).toLowerCase());
  }

  return allowedRoots.some(root => normalized.startsWith(root));
}

export function registerIpcHandlers(): void {
  // ── App ──────────────────────────────────────────────
  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IpcChannels.APP_QUIT, () => {
    app.quit();
  });

  // ── Window controls ──────────────────────────────────
  ipcMain.handle(IpcChannels.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle(IpcChannels.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle(IpcChannels.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  // ── Settings ─────────────────────────────────────────
  ipcMain.handle(IpcChannels.SETTINGS_GET, (_event, key: string) => {
    return settingsRepo.getSetting(key);
  });

  ipcMain.handle(IpcChannels.SETTINGS_SET, (_event, key: string, value: unknown) => {
    settingsRepo.setSetting(key, value);
    return true;
  });

  // ── Managed Folders ──────────────────────────────────
  ipcMain.handle(IpcChannels.SETTINGS_GET_FOLDERS, () => {
    return scanRepo.getManagedFolders();
  });

  ipcMain.handle(IpcChannels.SETTINGS_SET_FOLDERS, (_event, action: string, data: unknown) => {
    let result: unknown = false;
    switch (action) {
      case 'add': {
        const { path: folderPath, label, watchMode } = data as { path: string; label: string; watchMode: string };
        result = scanRepo.addManagedFolder(folderPath, label, watchMode);
        break;
      }
      case 'update': {
        const { id, updates } = data as { id: number; updates: Record<string, unknown> };
        scanRepo.updateManagedFolder(id, updates);
        result = true;
        break;
      }
      case 'remove': {
        const { id } = data as { id: number };
        scanRepo.removeManagedFolder(id);
        result = true;
        break;
      }
    }
    // Reload watchers so they reflect the updated folder list
    if (result) startWatching();
    return result;
  });

  // ── Categories ───────────────────────────────────────
  ipcMain.handle(IpcChannels.CATEGORIES_GET_ALL, () => {
    return categoryRepo.getAllCategories();
  });

  ipcMain.handle(IpcChannels.CATEGORIES_GET, (_event, id: number) => {
    return categoryRepo.getCategoryById(id);
  });

  // ── Files (read-only) ────────────────────────────────
  ipcMain.handle(IpcChannels.FILES_COUNT, () => {
    return fileRepo.getFileCount();
  });

  ipcMain.handle(IpcChannels.FILES_BY_CATEGORY, () => {
    return fileRepo.getFilesGroupedByCategory();
  });

  ipcMain.handle(IpcChannels.FILES_UNORGANIZED, () => {
    return fileRepo.getUnorganizedFiles();
  });

  // ── Move Log / Activity ──────────────────────────────
  ipcMain.handle(IpcChannels.ACTIVITY_RECENT, (_event, limit: number = 10) => {
    return moveLogRepo.getRecentActivity(limit);
  });

  ipcMain.handle(IpcChannels.ACTIVITY_SESSIONS, (_event, limit: number = 20) => {
    return moveLogRepo.getRecentSessions(limit);
  });

  // ── Storage Analyzer ────────────────────────────────
  ipcMain.handle(IpcChannels.STORAGE_SCAN_START, async (event, options: { drives: string[] }) => {
    if (isScanning()) return { error: 'Scan already in progress' };
    const senderWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await runStorageScan(options, senderWindow);
    return result;
  });

  ipcMain.handle(IpcChannels.STORAGE_ABORT, () => {
    abortScan();
    return true;
  });

  ipcMain.handle(IpcChannels.STORAGE_SCAN_RESULT, () => {
    return scanRepo.getScanResults();
  });

  ipcMain.handle(IpcChannels.STORAGE_SUMMARY, () => {
    return scanRepo.getScanSummary();
  });

  ipcMain.handle(IpcChannels.STORAGE_CLEANUP, async (_event, itemIds: number[]) => {
    return await cleanupApprovedItems(itemIds);
  });

  ipcMain.handle(IpcChannels.STORAGE_DRIVE_INFO, async (_event, drivePath: string) => {
    return await getDriveInfo(drivePath);
  });

  ipcMain.handle(IpcChannels.STORAGE_DRIVES, async () => {
    const driveLetters = ['C:/', 'D:/', 'E:/', 'F:/', 'G:/'];
    const drives = [];
    for (const letter of driveLetters) {
      const info = await getDriveInfo(letter);
      if (info) {
        drives.push({ path: letter, ...info });
      }
    }
    return drives;
  });

  // ── File Scanner / Classifier ──────────────────
  ipcMain.handle(IpcChannels.SCANNER_START, async (event, options: { folderPaths: string[]; useGemini: boolean }) => {
    if (isClassifying()) return { error: 'Classification already in progress' };
    const senderWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    return await runClassification(options, senderWindow);
  });

  ipcMain.handle(IpcChannels.SCANNER_ABORT, () => {
    abortClassification();
    return true;
  });

  ipcMain.handle(IpcChannels.SCANNER_RESULT, (_event, folderPaths?: string[]) => {
    return getClassifiedFiles(folderPaths);
  });

  ipcMain.handle(IpcChannels.SCANNER_IS_RUNNING, () => {
    return isClassifying();
  });

  ipcMain.handle(IpcChannels.SCANNER_GET_REVIEW_ITEMS, () => {
    return getPendingReviewItems();
  });

  ipcMain.handle(IpcChannels.SCANNER_RESOLVE_REVIEW, (_event, filePath: string, categorySlug: string) => {
    return resolveReviewItem(filePath, categorySlug);
  });

  // ── Gemini API Key ─────────────────────────────
  ipcMain.handle(IpcChannels.GEMINI_HAS_KEY, () => {
    return hasGeminiApiKey();
  });

  ipcMain.handle(IpcChannels.GEMINI_SET_KEY, (_event, apiKey: string) => {
    setGeminiApiKey(apiKey);
    return true;
  });

  // ── Auto-Organizer ─────────────────────────────
  ipcMain.handle(IpcChannels.ORGANIZER_GENERATE_PLAN, (_event, folderPaths?: string[]) => {
    return generateMovePlan(folderPaths);
  });

  ipcMain.handle(IpcChannels.ORGANIZER_EXECUTE, async (_event, approvedItems: MovePlanItem[]) => {
    const spaceCheck = await checkDiskSpace(approvedItems);
    if (!spaceCheck.ok) {
      return { error: 'Not enough disk space', ...spaceCheck };
    }
    return await executePlan(approvedItems);
  });

  ipcMain.handle(IpcChannels.ORGANIZER_UNDO, async (_event, moveLogId: number) => {
    return await undoMove(moveLogId);
  });

  ipcMain.handle(IpcChannels.ORGANIZER_UNDO_BATCH, async (_event, sessionId: string) => {
    return await undoSession(sessionId);
  });

  ipcMain.handle(IpcChannels.ORGANIZER_HISTORY, (_event, limit: number = 20) => {
    return getUndoHistory(limit);
  });

  ipcMain.handle(IpcChannels.ORGANIZER_SESSION_DETAILS, (_event, sessionId: string) => {
    return getSessionDetails(sessionId);
  });

  ipcMain.handle(IpcChannels.ORGANIZER_ANALYZE_PLAN, async (_event, planItems: MovePlanItem[]) => {
    return await analyzePlan(planItems);
  });

  // ── Quick Search ───────────────────────────────
  ipcMain.handle(IpcChannels.SEARCH_QUERY, (_event, query: string) => {
    return searchFiles(query);
  });

  ipcMain.handle(IpcChannels.SEARCH_REINDEX, () => {
    rebuildIndex();
    return true;
  });

  // ── Shell (with path validation) ───────────────
  ipcMain.handle(IpcChannels.SHELL_OPEN_FILE, async (_event, filePath: string) => {
    if (!isPathInManagedScope(filePath)) {
      throw new Error('Cannot open files outside managed folders');
    }
    return await shell.openPath(filePath);
  });

  ipcMain.handle(IpcChannels.SHELL_OPEN_FOLDER, (_event, filePath: string) => {
    if (!isPathInManagedScope(filePath)) {
      throw new Error('Cannot reveal files outside managed folders');
    }
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle(IpcChannels.SEARCH_RESIZE, (_event, resultCount: number) => {
    const { resizeSearchWindow } = require('./windows');
    resizeSearchWindow(resultCount);
    return true;
  });

  // ── Background Watcher ─────────────────────────
  ipcMain.handle(IpcChannels.WATCHER_COUNT, () => {
    return getWatchedFolderCount();
  });

  // ── Duplicate Finder ──────────────────────────
  ipcMain.handle(IpcChannels.STORAGE_FIND_DUPLICATES, async (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const filePaths = getAllFilesWithSize();

    const results = await findDuplicates(filePaths, (phase, current, total) => {
      senderWindow?.webContents.send(IpcChannels.STORAGE_DUPLICATES_PROGRESS, {
        phase,
        current,
        total,
      });
    });

    return results;
  });

  ipcMain.handle(IpcChannels.STORAGE_DELETE_DUPLICATE, async (_event, filePath: string) => {
    if (!isPathInManagedScope(filePath)) {
      throw new Error('Cannot delete files outside managed folders');
    }
    await shell.trashItem(filePath);
    return true;
  });

  // ── Auto-Scan Scheduler ──────────────────────────
  ipcMain.handle(IpcChannels.AUTO_SCAN_GET_INTERVAL, () => {
    return getAutoScanInterval();
  });

  ipcMain.handle(IpcChannels.AUTO_SCAN_SET_INTERVAL, (_event, hours: number) => {
    setAutoScanInterval(hours);
    return true;
  });

  ipcMain.handle(IpcChannels.AUTO_SCAN_RUN_NOW, async () => {
    await runAutoScan();
    return true;
  });

  ipcMain.handle(IpcChannels.AUTO_SCAN_LAST_RUN, () => {
    return settingsRepo.getSetting('last_auto_scan_at') as string | null;
  });

  // ── Batch Rename ───────────────────────────────
  ipcMain.handle(IpcChannels.BATCH_RENAME_PREVIEW, (_event, filePaths: string[]) => {
    return filePaths.map(fp => {
      const filename = path.basename(fp);
      const suggested = suggestBetterName(filename);
      return { path: fp, original: filename, suggested };
    });
  });

  ipcMain.handle(IpcChannels.BATCH_RENAME_EXECUTE, async (_event, renames: Array<{ oldPath: string; newName: string }>) => {
    const fs = require('fs') as typeof import('fs');
    const results: Array<{ oldPath: string; newPath: string; success: boolean; error?: string }> = [];

    for (const { oldPath, newName } of renames) {
      if (!isPathInManagedScope(oldPath)) {
        results.push({ oldPath, newPath: '', success: false, error: 'Outside managed folders' });
        continue;
      }

      const dir = path.dirname(oldPath);
      let newPath = path.join(dir, newName);

      // Resolve collision
      newPath = resolveCollision(newPath, (p) => fs.existsSync(p));

      try {
        fs.renameSync(oldPath, newPath);

        // Update tracked_files if the file is tracked
        const normalizedOld = oldPath.replace(/\\/g, '/');
        const normalizedNew = newPath.replace(/\\/g, '/');
        const file = fileRepo.getFileByPath(normalizedOld);
        if (file) {
          fileRepo.updateFilePath(file.id, normalizedNew, path.basename(newPath));

          // Log the rename for undo
          moveLogRepo.insertMoveLog({
            file_id: file.id,
            source_path: normalizedOld,
            dest_path: normalizedNew,
            old_filename: path.basename(oldPath),
            new_filename: path.basename(newPath),
            session_id: `rename-${Date.now()}`,
            operation: 'rename',
          });
        }

        results.push({ oldPath, newPath, success: true });
      } catch (err) {
        results.push({ oldPath, newPath, success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return results;
  });

  // ── Auto-Updater ────────────────────────────────
  ipcMain.handle(IpcChannels.UPDATER_CHECK, async () => {
    await checkForUpdates();
    return true;
  });

  ipcMain.handle(IpcChannels.UPDATER_DOWNLOAD, async () => {
    await downloadUpdate();
    return true;
  });

  ipcMain.handle(IpcChannels.UPDATER_INSTALL, () => {
    installUpdate();
    return true;
  });
}
