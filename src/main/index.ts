import { app, globalShortcut } from 'electron';
import { createTray } from './tray';
import { createDashboardWindow, createSearchWindow, getSearchWindow, destroyAllWindows } from './windows';
import { registerIpcHandlers } from './ipc-handlers';
import { getDatabase, closeDatabase } from './database/connection';
import { DEFAULT_SEARCH_HOTKEY } from '../shared/constants';
import { startWatching, stopWatching } from './modules/background-watcher/watcher';
import { startDigestScheduler, stopDigestScheduler } from './modules/background-watcher/digest';
import { startAutoScanScheduler, stopAutoScanScheduler } from './modules/background-watcher/auto-scan';
import { checkForUpdates } from './updater';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the dashboard if a second instance is attempted
    const { getDashboardWindow } = require('./windows');
    const win = getDashboardWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } else {
      createDashboardWindow();
    }
  });

  app.whenReady().then(() => {
    // Initialize database (runs migrations on first launch)
    getDatabase();
    console.log('[App] Database initialized');

    // Register IPC handlers before creating any windows
    registerIpcHandlers();

    // Create system tray
    createTray();

    // Open dashboard on first launch
    createDashboardWindow();

    // Register global search hotkey
    try {
      globalShortcut.register(DEFAULT_SEARCH_HOTKEY, () => {
        const searchWin = getSearchWindow();
        if (searchWin && searchWin.isVisible()) {
          searchWin.hide();
        } else {
          const win = createSearchWindow();
          win.show();
          win.focus();
        }
      });
    } catch (err) {
      console.warn('Failed to register global shortcut:', err);
    }

    // Start background file watcher
    startWatching();

    // Start weekly digest scheduler
    startDigestScheduler();

    // Start auto-scan scheduler (if configured)
    startAutoScanScheduler();

    // Check for updates (only in packaged builds — dev mode handled gracefully in updater.ts)
    setTimeout(() => checkForUpdates(), 5000);

    console.log('DeskPilot started successfully');
  });

  // Keep app running when all windows are closed (tray app)
  app.on('window-all-closed', () => {
    // Do nothing — app stays in tray
  });

  app.on('before-quit', () => {
    stopAutoScanScheduler();
    stopDigestScheduler();
    stopWatching();
    globalShortcut.unregisterAll();
    closeDatabase();
    destroyAllWindows();
  });
}
