import { BrowserWindow } from 'electron';
import * as settingsRepo from '../../database/repositories/settings-repo';
import * as scanRepo from '../../database/repositories/scan-repo';
import { runClassification, isClassifying } from '../file-classifier/classifier';

let autoScanTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the auto-scan scheduler.
 * Runs classification on managed folders at a configurable interval.
 * Interval is stored in settings as 'auto_scan_interval_hours' (default: 0 = disabled).
 */
export function startAutoScanScheduler(): void {
  stopAutoScanScheduler();

  const intervalHours = getAutoScanInterval();
  if (intervalHours <= 0) return; // Disabled

  const intervalMs = intervalHours * 60 * 60 * 1000;

  autoScanTimer = setInterval(() => {
    runAutoScan();
  }, intervalMs);

  console.log(`[AutoScan] Scheduler started: every ${intervalHours}h`);
}

/**
 * Stop the auto-scan scheduler.
 */
export function stopAutoScanScheduler(): void {
  if (autoScanTimer) {
    clearInterval(autoScanTimer);
    autoScanTimer = null;
  }
}

/**
 * Run an auto-scan now (if not already scanning).
 */
export async function runAutoScan(): Promise<void> {
  if (isClassifying()) {
    console.log('[AutoScan] Skipped — scan already in progress');
    return;
  }

  const folders = scanRepo.getManagedFolders();
  const activeFolders = folders.filter(f => f.is_active);
  if (activeFolders.length === 0) return;

  console.log(`[AutoScan] Running scheduled scan on ${activeFolders.length} folders...`);

  // Find main window for progress updates (optional)
  const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

  try {
    const result = await runClassification(
      {
        folderPaths: activeFolders.map(f => f.path),
        useGemini: false, // Auto-scans use rules only (no API cost)
      },
      mainWindow,
    );

    settingsRepo.setSetting('last_auto_scan_at', new Date().toISOString());
    console.log(`[AutoScan] Complete: ${result.totalDiscovered} discovered, ${result.ruleClassified} classified`);
  } catch (err) {
    console.error('[AutoScan] Failed:', err);
  }
}

/**
 * Get the configured auto-scan interval in hours (0 = disabled).
 */
export function getAutoScanInterval(): number {
  const val = settingsRepo.getSetting('auto_scan_interval_hours');
  if (val == null) return 0;
  const hours = Number(val);
  return isNaN(hours) ? 0 : hours;
}

/**
 * Set the auto-scan interval and restart the scheduler.
 */
export function setAutoScanInterval(hours: number): void {
  settingsRepo.setSetting('auto_scan_interval_hours', hours);
  startAutoScanScheduler();
}
