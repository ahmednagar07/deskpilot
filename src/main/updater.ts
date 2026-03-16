import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

// Don't auto-download — let the user confirm first
autoUpdater.autoDownload = false;

// ── Helper to send events to the renderer ────────────────────
function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = BrowserWindow.getAllWindows()[0];
  win?.webContents.send(channel, ...args);
}

// ── Event handlers ───────────────────────────────────────────
autoUpdater.on('checking-for-update', () => {
  console.log('[Updater] Checking for update...');
  sendToRenderer('updater:checking');
});

autoUpdater.on('update-available', (info) => {
  console.log('[Updater] Update available:', info.version);
  sendToRenderer('updater:available', info);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[Updater] No update available. Current version is up to date.');
  sendToRenderer('updater:not-available', info);
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`[Updater] Download progress: ${progress.percent.toFixed(1)}%`);
  sendToRenderer('updater:download-progress', progress);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Updater] Update downloaded:', info.version);
  sendToRenderer('updater:downloaded', info);
});

autoUpdater.on('error', (err) => {
  console.error('[Updater] Error:', err.message);
  sendToRenderer('updater:error', err.message);
});

// ── Exported actions ─────────────────────────────────────────
export function checkForUpdates(): void {
  console.log('[Updater] checkForUpdates() called');
  autoUpdater.checkForUpdates();
}

export function downloadUpdate(): void {
  console.log('[Updater] downloadUpdate() called');
  autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  console.log('[Updater] installUpdate() called — quitting and installing');
  autoUpdater.quitAndInstall();
}
