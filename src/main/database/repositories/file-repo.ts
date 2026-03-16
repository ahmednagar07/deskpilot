import { getDatabase } from '../connection';
import { TrackedFile } from '../../../shared/types';

export function insertFile(file: Omit<TrackedFile, 'id' | 'discovered_at' | 'indexed_at'>): number {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO tracked_files (original_path, current_path, filename, extension, size_bytes, hash_md5,
      category_id, classification_method, classification_confidence, is_organized, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    file.original_path, file.current_path, file.filename, file.extension,
    file.size_bytes, file.hash_md5, file.category_id, file.classification_method,
    file.classification_confidence, file.is_organized ? 1 : 0, file.modified_at
  );
  return result.lastInsertRowid as number;
}

export function getFileById(id: number): TrackedFile | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tracked_files WHERE id = ?').get(id) as TrackedFile | undefined;
}

export function getFileByPath(currentPath: string): TrackedFile | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tracked_files WHERE current_path = ?').get(currentPath) as TrackedFile | undefined;
}

export function getUnclassifiedFiles(): TrackedFile[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tracked_files WHERE category_id IS NULL').all() as TrackedFile[];
}

export function getFilesByCategory(categoryId: number): TrackedFile[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tracked_files WHERE category_id = ?').all(categoryId) as TrackedFile[];
}

export function getUnorganizedFiles(): TrackedFile[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tracked_files WHERE is_organized = 0').all() as TrackedFile[];
}

export function updateFileCategory(id: number, categoryId: number, method: string, confidence: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE tracked_files
    SET category_id = ?, classification_method = ?, classification_confidence = ?
    WHERE id = ?
  `).run(categoryId, method, confidence, id);
}

export function updateFilePath(id: number, newPath: string, newFilename?: string): void {
  const db = getDatabase();
  if (newFilename) {
    db.prepare('UPDATE tracked_files SET current_path = ?, filename = ?, is_organized = 1 WHERE id = ?')
      .run(newPath, newFilename, id);
  } else {
    db.prepare('UPDATE tracked_files SET current_path = ?, is_organized = 1 WHERE id = ?')
      .run(newPath, id);
  }
}

export function getFileCount(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM tracked_files').get() as { count: number };
  return row.count;
}

export function getFilesGroupedByCategory(): Array<{ category_name: string; category_slug: string; color: string; count: number; total_size: number }> {
  const db = getDatabase();
  return db.prepare(`
    SELECT c.name as category_name, c.slug as category_slug, c.color,
           COUNT(f.id) as count, COALESCE(SUM(f.size_bytes), 0) as total_size
    FROM categories c
    LEFT JOIN tracked_files f ON f.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order
  `).all() as Array<{ category_name: string; category_slug: string; color: string; count: number; total_size: number }>;
}

export function deleteFile(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM tracked_files WHERE id = ?').run(id);
}

export function getAllFilesWithSize(): Array<{ path: string; size: number }> {
  const db = getDatabase();
  return db.prepare('SELECT current_path as path, size_bytes as size FROM tracked_files').all() as Array<{ path: string; size: number }>;
}

export function fileExists(currentPath: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT 1 FROM tracked_files WHERE current_path = ?').get(currentPath);
  return !!row;
}
