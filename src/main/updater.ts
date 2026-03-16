import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';

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
  sendToRenderer(IpcChannels.UPDATER_CHECKING);
});

autoUpdater.on('update-available', (info) => {
  console.log('[Updater] Update available:', info.version);
  sendToRenderer(IpcChannels.UPDATER_AVAILABLE, info);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[Updater] No update available. Current version is up to date.');
  sendToRenderer(IpcChannels.UPDATER_NOT_AVAILABLE, info);
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`[Updater] Download progress: ${progress.percent.toFixed(1)}%`);
  sendToRenderer(IpcChannels.UPDATER_DOWNLOAD_PROGRESS, progress);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Updater] Update downloaded:', info.version);
  sendToRenderer(IpcChannels.UPDATER_DOWNLOADED, info);
});

autoUpdater.on('error', (err) => {
  console.error('[Updater] Error:', err.message);
  sendToRenderer(IpcChannels.UPDATER_ERROR, err.message);
});

// ── Exported actions ─────────────────────────────────────────
export async function checkForUpdates(): Promise<void> {
  console.log('[Updater] checkForUpdates() called');
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    // The autoUpdater 'error' event already sends UPDATER_ERROR to the renderer.
    // Only log here to avoid duplicate error toasts.
    console.error('[Updater] checkForUpdates failed:', err);
  }
}

export async function downloadUpdate(): Promise<void> {
  console.log('[Updater] downloadUpdate() called');
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    console.error('[Updater] downloadUpdate failed:', err);
  }
}

export function installUpdate(): void {
  console.log('[Updater] installUpdate() called — quitting and installing');
  autoUpdater.quitAndInstall();
}
