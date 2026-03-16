import { Notification } from 'electron';
import { getDatabase } from '../../database/connection';
import * as settingsRepo from '../../database/repositories/settings-repo';

interface DigestStats {
  filesDiscovered: number;
  filesOrganized: number;
  bytesReclaimed: number;
  topCategories: Array<{ name: string; count: number }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Collect stats from the past 7 days.
 */
export function getWeeklyStats(): DigestStats {
  const db = getDatabase();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Files discovered this week
  const discovered = db.prepare(
    `SELECT COUNT(*) as count FROM tracked_files WHERE discovered_at >= ?`
  ).get(oneWeekAgo) as { count: number };

  // Files organized (moved) this week
  const organized = db.prepare(
    `SELECT COUNT(*) as count FROM move_log WHERE executed_at >= ? AND operation = 'move' AND is_undone = 0`
  ).get(oneWeekAgo) as { count: number };

  // Bytes reclaimed (cleaned) this week — use scanned_at as proxy since cleaned_at column doesn't exist
  const reclaimed = db.prepare(
    `SELECT COALESCE(SUM(size_bytes), 0) as total FROM storage_scans WHERE is_cleaned = 1 AND scanned_at >= ?`
  ).get(oneWeekAgo) as { total: number };

  // Top categories by file count this week
  const topCategories = db.prepare(`
    SELECT c.name, COUNT(*) as count
    FROM tracked_files f
    JOIN categories c ON f.category_id = c.id
    WHERE f.discovered_at >= ?
    GROUP BY c.name
    ORDER BY count DESC
    LIMIT 3
  `).all(oneWeekAgo) as Array<{ name: string; count: number }>;

  return {
    filesDiscovered: discovered.count,
    filesOrganized: organized.count,
    bytesReclaimed: reclaimed.total,
    topCategories,
  };
}

/**
 * Show a weekly digest notification with stats summary.
 */
export function showWeeklyDigest(): void {
  const stats = getWeeklyStats();

  // Don't show if nothing happened
  if (stats.filesDiscovered === 0 && stats.filesOrganized === 0) return;

  const lines: string[] = [];
  if (stats.filesDiscovered > 0) lines.push(`${stats.filesDiscovered} files discovered`);
  if (stats.filesOrganized > 0) lines.push(`${stats.filesOrganized} files organized`);
  if (stats.bytesReclaimed > 0) lines.push(`${formatBytes(stats.bytesReclaimed)} reclaimed`);
  if (stats.topCategories.length > 0) {
    lines.push(`Top: ${stats.topCategories.map(c => c.name).join(', ')}`);
  }

  const notification = new Notification({
    title: 'DeskPilot Weekly Summary',
    body: lines.join(' · '),
    silent: false,
  });

  notification.show();

  // Record when we last showed the digest
  settingsRepo.setSetting('last_digest_at', new Date().toISOString());
}

let digestTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the weekly digest scheduler.
 * Checks daily if a week has passed since last digest.
 */
export function startDigestScheduler(): void {
  stopDigestScheduler();

  // Check every 12 hours
  digestTimer = setInterval(() => {
    const lastDigest = settingsRepo.getSetting('last_digest_at') as string | null;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    if (!lastDigest || Date.now() - new Date(lastDigest).getTime() >= oneWeekMs) {
      showWeeklyDigest();
    }
  }, 12 * 60 * 60 * 1000);

  // Also check on startup (after a short delay)
  setTimeout(() => {
    const lastDigest = settingsRepo.getSetting('last_digest_at') as string | null;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    if (!lastDigest || Date.now() - new Date(lastDigest).getTime() >= oneWeekMs) {
      showWeeklyDigest();
    }
  }, 60000); // 1 minute after startup
}

/**
 * Stop the digest scheduler.
 */
export function stopDigestScheduler(): void {
  if (digestTimer) {
    clearInterval(digestTimer);
    digestTimer = null;
  }
}
