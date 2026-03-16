import { describe, it, expect } from 'vitest';
import { suggestBetterName, resolveCollision } from '../src/main/modules/auto-organizer/name-suggester';

describe('suggestBetterName', () => {
  it('removes "New folder" prefix', () => {
    expect(suggestBetterName('New folder report.txt')).toBe('report.txt');
  });

  it('removes "Copy of" prefix', () => {
    expect(suggestBetterName('Copy of report.pdf')).toBe('report.pdf');
  });

  it('removes "Copy (2)" suffix', () => {
    expect(suggestBetterName('budget - Copy.xlsx')).toBe('budget.xlsx');
    expect(suggestBetterName('budget - Copy (2).xlsx')).toBe('budget.xlsx');
  });

  it('removes trailing numbering like "(2)"', () => {
    expect(suggestBetterName('presentation (3).pptx')).toBe('presentation.pptx');
  });

  it('removes leading numbered prefix "1. "', () => {
    expect(suggestBetterName('3. chapter three.docx')).toBe('chapter three.docx');
  });

  it('removes "Untitled" prefix', () => {
    // "Untitled" + "Document" patterns both fire, leaving empty → null
    expect(suggestBetterName('Untitled document.txt')).toBeNull();
    // With non-Document content, Untitled is properly stripped
    expect(suggestBetterName('Untitled sketch.psd')).toBe('sketch.psd');
  });

  it('returns null for already clean filenames', () => {
    expect(suggestBetterName('my-report.pdf')).toBeNull();
    expect(suggestBetterName('photo.jpg')).toBeNull();
    expect(suggestBetterName('README.md')).toBeNull();
  });

  it('returns null if cleaning removes everything', () => {
    expect(suggestBetterName('New folder.txt')).toBeNull();
  });

  it('handles files with no extension', () => {
    expect(suggestBetterName('Copy of Makefile')).toBe('Makefile');
  });

  it('is case insensitive for patterns', () => {
    expect(suggestBetterName('COPY OF design.fig')).toBe('design.fig');
    expect(suggestBetterName('new FOLDER sketch.ai')).toBe('sketch.ai');
  });
});

describe('resolveCollision', () => {
  it('returns original path when no collision', () => {
    const result = resolveCollision('/home/user/file.txt', () => false);
    expect(result).toBe('/home/user/file.txt');
  });

  it('appends (2) on first collision', () => {
    const existing = new Set(['/home/user/file.txt']);
    const result = resolveCollision('/home/user/file.txt', (p) => existing.has(p));
    expect(result).toContain('file (2).txt');
  });

  it('increments counter for multiple collisions', () => {
    const existing = new Set([
      '/home/user/file.txt',
      expect.stringContaining('file (2).txt'),
    ]);
    // Simulate first two exist
    let callCount = 0;
    const result = resolveCollision('/home/user/file.txt', () => {
      callCount++;
      return callCount <= 2; // first two calls return true (exist)
    });
    expect(result).toContain('file (3).txt');
  });

  it('preserves directory and extension', () => {
    const result = resolveCollision('C:/docs/report.pdf', () => false);
    expect(result).toBe('C:/docs/report.pdf');
  });
});
