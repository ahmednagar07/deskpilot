import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { findDuplicates, type DuplicateGroup } from '../src/main/modules/storage-analyzer/duplicate-finder';

const TEST_DIR = path.join(os.tmpdir(), 'deskpilot-test-duplicates');

function setup() {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function cleanup() {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

function createFile(name: string, content: string): { path: string; size: number } {
  const filePath = path.join(TEST_DIR, name);
  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  const stat = fs.statSync(filePath);
  return { path: filePath, size: stat.size };
}

describe('findDuplicates', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('finds exact duplicate files', async () => {
    // Two files with identical content (>1KB to not be skipped)
    const content = 'A'.repeat(2048);
    const file1 = createFile('dup1.txt', content);
    const file2 = createFile('dup2.txt', content);

    const results = await findDuplicates([file1, file2]);

    expect(results).toHaveLength(1);
    expect(results[0].files).toHaveLength(2);
    expect(results[0].files).toContain(file1.path);
    expect(results[0].files).toContain(file2.path);
    expect(results[0].size).toBe(file1.size);
  });

  it('returns empty array when no duplicates exist', async () => {
    const file1 = createFile('unique1.txt', 'A'.repeat(2048));
    const file2 = createFile('unique2.txt', 'B'.repeat(2048));

    const results = await findDuplicates([file1, file2]);
    expect(results).toHaveLength(0);
  });

  it('skips files smaller than 1KB', async () => {
    const content = 'tiny'; // < 1024 bytes
    const file1 = createFile('small1.txt', content);
    const file2 = createFile('small2.txt', content);

    const results = await findDuplicates([file1, file2]);
    expect(results).toHaveLength(0);
  });

  it('groups files by content not by name', async () => {
    const content = 'C'.repeat(2048);
    const file1 = createFile('dir1/photo.jpg', content);
    const file2 = createFile('dir2/backup.dat', content);

    const results = await findDuplicates([file1, file2]);
    expect(results).toHaveLength(1);
  });

  it('handles multiple duplicate groups', async () => {
    const contentA = 'A'.repeat(2048);
    const contentB = 'B'.repeat(2048);

    const a1 = createFile('a1.txt', contentA);
    const a2 = createFile('a2.txt', contentA);
    const b1 = createFile('b1.txt', contentB);
    const b2 = createFile('b2.txt', contentB);
    const unique = createFile('unique.txt', 'C'.repeat(2048));

    const results = await findDuplicates([a1, a2, b1, b2, unique]);
    expect(results).toHaveLength(2);

    const allDupFiles = results.flatMap(g => g.files);
    expect(allDupFiles).toContain(a1.path);
    expect(allDupFiles).toContain(a2.path);
    expect(allDupFiles).toContain(b1.path);
    expect(allDupFiles).toContain(b2.path);
    expect(allDupFiles).not.toContain(unique.path);
  });

  it('handles three-way duplicates', async () => {
    const content = 'D'.repeat(2048);
    const file1 = createFile('copy1.txt', content);
    const file2 = createFile('copy2.txt', content);
    const file3 = createFile('copy3.txt', content);

    const results = await findDuplicates([file1, file2, file3]);
    expect(results).toHaveLength(1);
    expect(results[0].files).toHaveLength(3);
  });

  it('distinguishes files with same size but different content', async () => {
    // Same size (2048 bytes) but different content
    const file1 = createFile('same-size-a.txt', 'A'.repeat(2048));
    const file2 = createFile('same-size-b.txt', 'B'.repeat(2048));

    const results = await findDuplicates([file1, file2]);
    expect(results).toHaveLength(0);
  });

  it('calls progress callback for each phase', async () => {
    const content = 'E'.repeat(2048);
    const file1 = createFile('p1.txt', content);
    const file2 = createFile('p2.txt', content);

    const progressCalls: string[] = [];
    const onProgress = (phase: string) => {
      if (!progressCalls.includes(phase)) progressCalls.push(phase);
    };

    await findDuplicates([file1, file2], onProgress);

    expect(progressCalls).toContain('Grouping by size');
    expect(progressCalls).toContain('Partial hashing');
    expect(progressCalls).toContain('Full hashing');
  });

  it('handles empty input', async () => {
    const results = await findDuplicates([]);
    expect(results).toHaveLength(0);
  });

  it('handles single file (no possible duplicates)', async () => {
    const file = createFile('lonely.txt', 'F'.repeat(2048));
    const results = await findDuplicates([file]);
    expect(results).toHaveLength(0);
  });

  it('returns correct hash for each group', async () => {
    const content = 'G'.repeat(2048);
    const file1 = createFile('hash1.txt', content);
    const file2 = createFile('hash2.txt', content);

    const results = await findDuplicates([file1, file2]);
    expect(results[0].hash).toMatch(/^[a-f0-9]{32}$/); // MD5 hex format
  });
});
