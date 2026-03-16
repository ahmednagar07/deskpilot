import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock database repositories
vi.mock('../src/main/database/repositories/file-repo', () => ({
  updateFilePath: vi.fn(),
}));
vi.mock('../src/main/database/repositories/move-log-repo', () => ({
  insertMoveLog: vi.fn(),
}));

import { executePlan, type ExecutionResult } from '../src/main/modules/auto-organizer/move-executor';
import * as fileRepo from '../src/main/database/repositories/file-repo';
import * as moveLogRepo from '../src/main/database/repositories/move-log-repo';

const TEST_DIR = path.join(os.tmpdir(), 'deskpilot-test-executor');
const SRC_DIR = path.join(TEST_DIR, 'source');
const DEST_DIR = path.join(TEST_DIR, 'dest');

function setup() {
  fs.mkdirSync(SRC_DIR, { recursive: true });
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

function cleanup() {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

describe('executePlan', () => {
  beforeEach(() => {
    setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('moves a single file to the destination', async () => {
    const srcFile = path.join(SRC_DIR, 'report.pdf');
    const destFile = path.join(DEST_DIR, 'report.pdf');
    fs.writeFileSync(srcFile, 'pdf content');

    const result = await executePlan([{
      fileId: 1,
      currentPath: srcFile,
      destPath: destFile,
      currentName: 'report.pdf',
      suggestedName: null,
      category: 'Documents',
      approved: true,
    }]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.sessionId).toBeTruthy();
    expect(fs.existsSync(destFile)).toBe(true);
    expect(fs.existsSync(srcFile)).toBe(false);
  });

  it('resolves filename collisions by appending (2)', async () => {
    const srcFile = path.join(SRC_DIR, 'doc.txt');
    const destFile = path.join(DEST_DIR, 'doc.txt');
    const expectedDest = path.join(DEST_DIR, 'doc (2).txt');

    fs.writeFileSync(srcFile, 'new content');
    fs.writeFileSync(destFile, 'existing content'); // already exists

    const result = await executePlan([{
      fileId: 1,
      currentPath: srcFile,
      destPath: destFile,
      currentName: 'doc.txt',
      suggestedName: null,
      category: 'Documents',
      approved: true,
    }]);

    expect(result.succeeded).toBe(1);
    expect(fs.existsSync(expectedDest)).toBe(true);
    expect(fs.readFileSync(expectedDest, 'utf-8')).toBe('new content');
  });

  it('creates destination directory if it does not exist', async () => {
    const srcFile = path.join(SRC_DIR, 'file.txt');
    const destFile = path.join(DEST_DIR, 'sub', 'deep', 'file.txt');
    fs.writeFileSync(srcFile, 'content');

    const result = await executePlan([{
      fileId: 1,
      currentPath: srcFile,
      destPath: destFile,
      currentName: 'file.txt',
      suggestedName: null,
      category: 'Test',
      approved: true,
    }]);

    expect(result.succeeded).toBe(1);
    expect(fs.existsSync(destFile)).toBe(true);
  });

  it('reports error for missing source files', async () => {
    const result = await executePlan([{
      fileId: 1,
      currentPath: path.join(SRC_DIR, 'nonexistent.txt'),
      destPath: path.join(DEST_DIR, 'nonexistent.txt'),
      currentName: 'nonexistent.txt',
      suggestedName: null,
      category: 'Test',
      approved: true,
    }]);

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toContain('no longer exists');
  });

  it('logs every successful move to move_log', async () => {
    const srcFile = path.join(SRC_DIR, 'tracked.txt');
    const destFile = path.join(DEST_DIR, 'tracked.txt');
    fs.writeFileSync(srcFile, 'data');

    await executePlan([{
      fileId: 42,
      currentPath: srcFile,
      destPath: destFile,
      currentName: 'tracked.txt',
      suggestedName: null,
      category: 'Test',
      approved: true,
    }]);

    expect(moveLogRepo.insertMoveLog).toHaveBeenCalledTimes(1);
    expect(moveLogRepo.insertMoveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        file_id: 42,
        source_path: srcFile,
        old_filename: 'tracked.txt',
        new_filename: 'tracked.txt',
      })
    );
  });

  it('updates tracked file path after move', async () => {
    const srcFile = path.join(SRC_DIR, 'update.txt');
    const destFile = path.join(DEST_DIR, 'update.txt');
    fs.writeFileSync(srcFile, 'data');

    await executePlan([{
      fileId: 7,
      currentPath: srcFile,
      destPath: destFile,
      currentName: 'update.txt',
      suggestedName: null,
      category: 'Test',
      approved: true,
    }]);

    expect(fileRepo.updateFilePath).toHaveBeenCalledTimes(1);
    expect(fileRepo.updateFilePath).toHaveBeenCalledWith(
      7,
      expect.stringContaining('update.txt'),
      'update.txt'
    );
  });

  it('handles multiple files in a batch', async () => {
    const files = ['a.txt', 'b.txt', 'c.txt'];
    const planItems = files.map((f, i) => {
      const src = path.join(SRC_DIR, f);
      fs.writeFileSync(src, `content-${i}`);
      return {
        fileId: i + 1,
        currentPath: src,
        destPath: path.join(DEST_DIR, f),
        currentName: f,
        suggestedName: null,
        category: 'Test',
        approved: true,
      };
    });

    const result = await executePlan(planItems);

    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    files.forEach(f => {
      expect(fs.existsSync(path.join(DEST_DIR, f))).toBe(true);
    });
  });

  it('continues batch after individual file failure', async () => {
    // First file doesn't exist, second does
    const srcFile = path.join(SRC_DIR, 'good.txt');
    fs.writeFileSync(srcFile, 'ok');

    const result = await executePlan([
      {
        fileId: 1,
        currentPath: path.join(SRC_DIR, 'bad.txt'),
        destPath: path.join(DEST_DIR, 'bad.txt'),
        currentName: 'bad.txt',
        suggestedName: null,
        category: 'Test',
        approved: true,
      },
      {
        fileId: 2,
        currentPath: srcFile,
        destPath: path.join(DEST_DIR, 'good.txt'),
        currentName: 'good.txt',
        suggestedName: null,
        category: 'Test',
        approved: true,
      },
    ]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(fs.existsSync(path.join(DEST_DIR, 'good.txt'))).toBe(true);
  });

  it('returns a unique session ID per execution', async () => {
    const srcFile1 = path.join(SRC_DIR, 'file1.txt');
    const srcFile2 = path.join(SRC_DIR, 'file2.txt');
    fs.writeFileSync(srcFile1, 'a');
    fs.writeFileSync(srcFile2, 'b');

    const result1 = await executePlan([{
      fileId: 1, currentPath: srcFile1, destPath: path.join(DEST_DIR, 'file1.txt'),
      currentName: 'file1.txt', suggestedName: null, category: 'Test', approved: true,
    }]);

    // Reset for second run
    fs.mkdirSync(SRC_DIR, { recursive: true });
    fs.writeFileSync(srcFile2, 'b');

    const result2 = await executePlan([{
      fileId: 2, currentPath: srcFile2, destPath: path.join(DEST_DIR, 'file2.txt'),
      currentName: 'file2.txt', suggestedName: null, category: 'Test', approved: true,
    }]);

    expect(result1.sessionId).not.toBe(result2.sessionId);
  });
});
