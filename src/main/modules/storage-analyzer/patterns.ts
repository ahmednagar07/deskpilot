import os from 'os';
import path from 'path';

const homeDir = os.homedir().replace(/\\/g, '/');

/**
 * Known temporary file patterns — safe to clean.
 */
export const TEMP_FILE_PATTERNS: string[] = [
  'Thumbs.db',
  'desktop.ini',
  '.DS_Store',
  '*.tmp',
  '*.temp',
  '~$*',           // Office lock files
  '*.bak',
  '*.log',
  '*.swp',
  '*.swo',
];

/**
 * Known temporary/cache directories — contents safe to clean.
 */
export const TEMP_DIRECTORIES: string[] = [
  // Windows temp
  path.join(os.tmpdir()).replace(/\\/g, '/'),
  `${homeDir}/AppData/Local/Temp`,

  // Browser caches
  `${homeDir}/AppData/Local/Google/Chrome/User Data/Default/Cache`,
  `${homeDir}/AppData/Local/Google/Chrome/User Data/Default/Code Cache`,
  `${homeDir}/AppData/Local/Microsoft/Edge/User Data/Default/Cache`,
  `${homeDir}/AppData/Local/Microsoft/Edge/User Data/Default/Code Cache`,
  `${homeDir}/AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/Cache`,
  `${homeDir}/AppData/Local/Mozilla/Firefox/Profiles`,

  // App caches
  `${homeDir}/AppData/Local/npm-cache`,
  `${homeDir}/AppData/Local/yarn/Cache`,
  `${homeDir}/AppData/Local/pnpm/store`,
  `${homeDir}/AppData/Local/pip/Cache`,
  `${homeDir}/AppData/Local/NuGet/Cache`,

  // Electron/VS Code caches
  `${homeDir}/AppData/Roaming/Code/Cache`,
  `${homeDir}/AppData/Roaming/Code/CachedData`,
  `${homeDir}/AppData/Roaming/Code/CachedExtensions`,
  `${homeDir}/AppData/Roaming/Code/CachedProfilesData`,

  // Other
  `${homeDir}/AppData/Local/CrashDumps`,
  `${homeDir}/AppData/Local/D3DSCache`,
];

/**
 * Directory names that indicate a node_modules folder.
 */
export const NODE_MODULES_DIR = 'node_modules';

/**
 * Large file threshold in bytes (default 500MB).
 */
export const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024;

/**
 * Extensions commonly associated with large/unnecessary files.
 */
export const LARGE_FILE_EXTENSIONS = new Set([
  '.iso', '.vmdk', '.vhd', '.vhdx',  // Disk images
  '.msi', '.exe',                      // Installers (in Downloads)
  '.torrent',
]);

/**
 * Check if a filename matches any temp file pattern.
 */
export function isTempFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  for (const pattern of TEMP_FILE_PATTERNS) {
    if (pattern.startsWith('*.')) {
      // Extension match
      if (lower.endsWith(pattern.slice(1))) return true;
    } else if (pattern.startsWith('~$')) {
      // Prefix match (Office lock files)
      if (lower.startsWith('~$')) return true;
    } else {
      // Exact match
      if (lower === pattern.toLowerCase()) return true;
    }
  }
  return false;
}

/**
 * Check if a directory path is a known cache directory.
 */
export function isCacheDirectory(dirPath: string): boolean {
  const normalized = dirPath.replace(/\\/g, '/').toLowerCase();
  return TEMP_DIRECTORIES.some(td => normalized.startsWith(td.toLowerCase()));
}

/**
 * Check if a path segment is node_modules.
 */
export function isNodeModules(dirName: string): boolean {
  return dirName === NODE_MODULES_DIR;
}
