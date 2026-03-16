import { getDatabase } from '../connection';
import { MoveLogEntry } from '../../../shared/types';

export function insertMoveLog(entry: Omit<MoveLogEntry, 'id' | 'is_undone' | 'executed_at' | 'undone_at'>): number {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO move_log (file_id, source_path, dest_path, old_filename, new_filename, session_id, operation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.file_id, entry.source_path, entry.dest_path,
    entry.old_filename, entry.new_filename, entry.session_id, entry.operation
  );
  return result.lastInsertRowid as number;
}

export function getMoveLogById(id: number): MoveLogEntry | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM move_log WHERE id = ?').get(id) as MoveLogEntry | undefined;
}

export function getMoveLogBySession(sessionId: string): MoveLogEntry[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM move_log WHERE session_id = ? ORDER BY id DESC').all(sessionId) as MoveLogEntry[];
}

export function getRecentSessions(limit: number = 20): Array<{ session_id: string; count: number; executed_at: string }> {
  const db = getDatabase();
  return db.prepare(`
    SELECT session_id, COUNT(*) as count, MAX(executed_at) as executed_at
    FROM move_log
    WHERE is_undone = 0
    GROUP BY session_id
    ORDER BY executed_at DESC
    LIMIT ?
  `).all(limit) as Array<{ session_id: string; count: number; executed_at: string }>;
}

export function markUndone(id: number): void {
  const db = getDatabase();
  db.prepare("UPDATE move_log SET is_undone = 1, undone_at = datetime('now') WHERE id = ?").run(id);
}

export function markSessionUndone(sessionId: string): void {
  const db = getDatabase();
  db.prepare("UPDATE move_log SET is_undone = 1, undone_at = datetime('now') WHERE session_id = ?").run(sessionId);
}

export function getUndoableEntries(sessionId: string): MoveLogEntry[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM move_log WHERE session_id = ? AND is_undone = 0 ORDER BY id DESC'
  ).all(sessionId) as MoveLogEntry[];
}

export function getRecentActivity(limit: number = 10): MoveLogEntry[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM move_log ORDER BY executed_at DESC LIMIT ?').all(limit) as MoveLogEntry[];
}
