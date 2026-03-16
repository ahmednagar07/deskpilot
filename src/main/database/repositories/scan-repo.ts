import { getDatabase } from '../connection';
import { StorageScanItem, ManagedFolder } from '../../../shared/types';

// Storage scans
export function insertScanItem(item: Omit<StorageScanItem, 'id' | 'is_approved' | 'is_cleaned' | 'scanned_at'>): number {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO storage_scans (drive_path, scan_type, item_path, size_bytes)
    VALUES (?, ?, ?, ?)
  `).run(item.drive_path, item.scan_type, item.item_path, item.size_bytes);
  return result.lastInsertRowid as number;
}

export function getScanResults(drivePath?: string): StorageScanItem[] {
  const db = getDatabase();
  if (drivePath) {
    return db.prepare('SELECT * FROM storage_scans WHERE drive_path = ? AND is_cleaned = 0 ORDER BY size_bytes DESC')
      .all(drivePath) as StorageScanItem[];
  }
  return db.prepare('SELECT * FROM storage_scans WHERE is_cleaned = 0 ORDER BY size_bytes DESC')
    .all() as StorageScanItem[];
}

export function getScanSummary(): Array<{ scan_type: string; count: number; total_size: number }> {
  const db = getDatabase();
  return db.prepare(`
    SELECT scan_type, COUNT(*) as count, SUM(size_bytes) as total_size
    FROM storage_scans
    WHERE is_cleaned = 0
    GROUP BY scan_type
    ORDER BY total_size DESC
  `).all() as Array<{ scan_type: string; count: number; total_size: number }>;
}

export function approveScanItems(ids: number[]): void {
  const db = getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE storage_scans SET is_approved = 1 WHERE id IN (${placeholders})`).run(...ids);
}

export function markCleaned(ids: number[]): void {
  const db = getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE storage_scans SET is_cleaned = 1 WHERE id IN (${placeholders})`).run(...ids);
}

export function clearScanResults(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM storage_scans').run();
}

// Managed folders
export function getManagedFolders(): ManagedFolder[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM managed_folders ORDER BY added_at').all() as ManagedFolder[];
}

export function getActiveManagedFolders(): ManagedFolder[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM managed_folders WHERE is_active = 1 ORDER BY added_at').all() as ManagedFolder[];
}

export function addManagedFolder(folderPath: string, label: string, watchMode: string = 'notify'): number {
  const db = getDatabase();
  const result = db.prepare(
    'INSERT INTO managed_folders (path, label, watch_mode) VALUES (?, ?, ?)'
  ).run(folderPath, label, watchMode);
  return result.lastInsertRowid as number;
}

export function updateManagedFolder(id: number, updates: Partial<Pick<ManagedFolder, 'label' | 'is_active' | 'watch_mode'>>): void {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.label !== undefined) { fields.push('label = ?'); values.push(updates.label); }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active ? 1 : 0); }
  if (updates.watch_mode !== undefined) { fields.push('watch_mode = ?'); values.push(updates.watch_mode); }

  if (fields.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE managed_folders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function removeManagedFolder(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM managed_folders WHERE id = ?').run(id);
}
