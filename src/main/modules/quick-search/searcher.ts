import { getDatabase } from '../../database/connection';

export interface SearchResult {
  id: number;
  filename: string;
  current_path: string;
  extension: string | null;
  size_bytes: number;
  category_name: string | null;
  category_slug: string | null;
  category_color: string | null;
  category_icon: string | null;
  rank: number;
}

/**
 * Search files using FTS5 full-text search.
 * Supports prefix matching (e.g., "rep*" matches "report").
 */
export function searchFiles(query: string, limit: number = 30): SearchResult[] {
  if (!query.trim()) return [];

  const db = getDatabase();

  // Build FTS5 query: add prefix matching
  // Strip double quotes to prevent FTS5 syntax injection
  const terms = query.trim().split(/\s+/).map(t => `"${t.replace(/"/g, '')}"*`).join(' ');

  try {
    return db.prepare(`
      SELECT
        f.id, f.filename, f.current_path, f.extension, f.size_bytes,
        c.name as category_name, c.slug as category_slug,
        c.color as category_color, c.icon as category_icon,
        fts.rank
      FROM files_fts fts
      JOIN tracked_files f ON f.id = fts.rowid
      LEFT JOIN categories c ON c.id = f.category_id
      WHERE files_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `).all(terms, limit) as SearchResult[];
  } catch {
    // If FTS query syntax is invalid, fall back to LIKE
    const likePattern = `%${query.trim()}%`;
    return db.prepare(`
      SELECT
        f.id, f.filename, f.current_path, f.extension, f.size_bytes,
        c.name as category_name, c.slug as category_slug,
        c.color as category_color, c.icon as category_icon,
        0 as rank
      FROM tracked_files f
      LEFT JOIN categories c ON c.id = f.category_id
      WHERE f.filename LIKE ? OR f.current_path LIKE ?
      ORDER BY f.filename
      LIMIT ?
    `).all(likePattern, likePattern, limit) as SearchResult[];
  }
}

/**
 * Rebuild the FTS5 index from scratch.
 * Useful if the index gets out of sync.
 */
export function rebuildIndex(): void {
  const db = getDatabase();
  db.prepare("INSERT INTO files_fts(files_fts) VALUES('rebuild')").run();
}
