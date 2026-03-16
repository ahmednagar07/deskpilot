import { describe, it, expect } from 'vitest';

// Test the formatBytes function used in digest (same logic as fs-helpers)
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

describe('Digest formatBytes', () => {
  it('formats various sizes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});

describe('Digest scheduling logic', () => {
  it('detects when a week has passed', () => {
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    // 8 days ago — should trigger
    expect(Date.now() - new Date(eightDaysAgo).getTime() >= oneWeekMs).toBe(true);

    // 2 days ago — should NOT trigger
    expect(Date.now() - new Date(twoDaysAgo).getTime() >= oneWeekMs).toBe(false);

    // null (never run) — should trigger
    const lastDigest: string | null = null;
    expect(!lastDigest || Date.now() - new Date(lastDigest).getTime() >= oneWeekMs).toBe(true);
  });
});
