import { getDatabase } from '../connection';
import { Category } from '../../../shared/types';

export function getAllCategories(): Category[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM categories ORDER BY sort_order').all() as Category[];
}

export function getCategoryById(id: number): Category | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
}

export function getCategoryBySlug(slug: string): Category | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as Category | undefined;
}

export function updateCategory(id: number, updates: Partial<Pick<Category, 'name' | 'color' | 'target_path' | 'icon'>>): void {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
  if (updates.target_path !== undefined) { fields.push('target_path = ?'); values.push(updates.target_path); }
  if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }

  if (fields.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}
