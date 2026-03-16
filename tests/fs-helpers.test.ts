import { describe, it, expect } from 'vitest';
import { formatBytes, normalizePath } from '../src/main/utils/fs-helpers';
import { hashFile, getFileInfo } from '../src/main/utils/fs-helpers';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(10485760)).toBe('10 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('formats terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1 TB');
  });
});

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('C:\\Users\\name\\file.txt')).toBe('C:/Users/name/file.txt');
  });

  it('leaves forward slashes unchanged', () => {
    expect(normalizePath('/home/user/file.txt')).toBe('/home/user/file.txt');
  });

  it('handles mixed slashes', () => {
    expect(normalizePath('C:\\Users/name\\Documents/file.txt')).toBe('C:/Users/name/Documents/file.txt');
  });
});

describe('hashFile', () => {
  it('hashes a real file', async () => {
    const tmpFile = path.join(os.tmpdir(), 'deskpilot-test-hash.txt');
    fs.writeFileSync(tmpFile, 'hello world');

    const hash = await hashFile(tmpFile);
    expect(hash).toBeTruthy();
    expect(hash).toHaveLength(32); // MD5 hex length

    // MD5 of "hello world" is known
    expect(hash).toBe('5eb63bbbe01eeed093cb22bb8f5acdc3');

    fs.unlinkSync(tmpFile);
  });

  it('hashes partial file content', async () => {
    const tmpFile = path.join(os.tmpdir(), 'deskpilot-test-partial.txt');
    fs.writeFileSync(tmpFile, 'abcdefghij');

    const fullHash = await hashFile(tmpFile);
    const partialHash = await hashFile(tmpFile, 5);

    expect(fullHash).not.toBe(partialHash); // different since partial reads less
    expect(partialHash).toHaveLength(32);

    fs.unlinkSync(tmpFile);
  });

  it('returns null for non-existent file', async () => {
    const hash = await hashFile('/nonexistent/path/file.xyz');
    expect(hash).toBeNull();
  });
});

describe('getFileInfo', () => {
  it('returns info for existing file', async () => {
    const tmpFile = path.join(os.tmpdir(), 'deskpilot-test-info.txt');
    fs.writeFileSync(tmpFile, 'test content');

    const info = await getFileInfo(tmpFile);
    expect(info).toBeTruthy();
    expect(info!.name).toBe('deskpilot-test-info.txt');
    expect(info!.extension).toBe('.txt');
    expect(info!.sizeBytes).toBe(12);
    expect(info!.isDirectory).toBe(false);

    fs.unlinkSync(tmpFile);
  });

  it('returns null for non-existent file', async () => {
    const info = await getFileInfo('/nonexistent/file.txt');
    expect(info).toBeNull();
  });
});
