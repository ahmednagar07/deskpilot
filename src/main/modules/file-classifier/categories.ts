import * as categoryRepo from '../../database/repositories/category-repo';
import { Category } from '../../../shared/types';

// In-memory cache of categories (they rarely change)
let categoryCache: Category[] | null = null;

export function getCategories(): Category[] {
  if (!categoryCache) {
    categoryCache = categoryRepo.getAllCategories();
  }
  return categoryCache;
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return getCategories().find(c => c.slug === slug);
}

export function getCategoryById(id: number): Category | undefined {
  return getCategories().find(c => c.id === id);
}

export function invalidateCategoryCache(): void {
  categoryCache = null;
}

/** Build a display-friendly label for the Gemini prompt. */
export function getCategoryListForPrompt(): string {
  return getCategories()
    .map(c => `- ${c.slug}: ${c.name} (target folder: ${c.target_path})`)
    .join('\n');
}
