import path from 'path';

// Patterns to clean from filenames
const JUNK_PATTERNS = [
  /^New folder\s*/i,
  /^Copy of\s+/i,
  /^Copy\s*\(\d+\)\s*-?\s*/i,
  /\s*-\s*Copy\s*(\(\d+\))?$/i,
  /\s*\(\d+\)$/,               // trailing "(2)"
  /^\d+\.\s*/,                  // leading "1. "
  /^Untitled\s*/i,
  /^Document\s*/i,
];

/**
 * Suggest a cleaner filename if the current one has common junk patterns.
 * Returns null if the filename is already clean.
 */
export function suggestBetterName(filename: string): string | null {
  const ext = path.extname(filename);
  let name = path.basename(filename, ext);
  const original = name;

  for (const pattern of JUNK_PATTERNS) {
    name = name.replace(pattern, '');
  }

  // Trim whitespace and dashes
  name = name.replace(/^[\s\-_]+|[\s\-_]+$/g, '');

  // If we cleaned away everything, don't suggest
  if (!name || name === original) return null;

  return name + ext;
}

/**
 * Ensure a destination path doesn't collide with existing files.
 * Appends " (2)", " (3)", etc. if needed.
 */
export function resolveCollision(destPath: string, existsCheck: (p: string) => boolean): string {
  if (!existsCheck(destPath)) return destPath;

  const dir = path.dirname(destPath);
  const ext = path.extname(destPath);
  const base = path.basename(destPath, ext);

  let counter = 2;
  while (counter < 100) {
    const candidate = path.join(dir, `${base} (${counter})${ext}`);
    if (!existsCheck(candidate)) return candidate;
    counter++;
  }

  // Fallback with timestamp
  return path.join(dir, `${base}_${Date.now()}${ext}`);
}
