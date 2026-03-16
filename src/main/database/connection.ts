import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';

let db: Database.Database | null = null;

function getDbPath(): string {
  const isPackaged = app.isPackaged;
  if (isPackaged) {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'deskpilot.db');
  }
  // Development: store in project root /data/
  const projectRoot = path.resolve(__dirname, '../../..');
  const dataDir = path.join(projectRoot, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'deskpilot.db');
}

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  console.log(`[DB] Opening database at: ${dbPath}`);

  db = new Database(dbPath);

  // Performance settings
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Run migrations
  runMigrations(db);

  // Seed dynamic defaults (OS-specific paths) if not already set
  seedDynamicDefaults(db);

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database closed');
  }
}

function runMigrations(database: Database.Database): void {
  const currentVersion = database.pragma('user_version', { simple: true }) as number;
  console.log(`[DB] Current schema version: ${currentVersion}`);

  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.warn(`[DB] Migrations directory not found: ${migrationsDir}`);
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const match = file.match(/^(\d+)/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    if (version <= currentVersion) continue;

    console.log(`[DB] Running migration ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    database.transaction(() => {
      database.exec(sql);
      database.pragma(`user_version = ${version}`);
    })();

    console.log(`[DB] Migration ${file} complete. Version now: ${version}`);
  }
}

export function backupDatabase(): string | null {
  if (!db) return null;

  const dbPath = getDbPath();
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `deskpilot-${timestamp}.db`);

  db.backup(backupPath);
  console.log(`[DB] Backup created: ${backupPath}`);

  // Keep only the last 5 backups
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('deskpilot-') && f.endsWith('.db'))
    .sort()
    .reverse();

  for (const old of backups.slice(5)) {
    fs.unlinkSync(path.join(backupDir, old));
  }

  return backupPath;
}

/**
 * Seed OS-specific default paths after migrations.
 * Only inserts if values are empty/missing — won't overwrite user changes.
 */
function seedDynamicDefaults(database: Database.Database): void {
  // Set organized_root if empty
  const rootRow = database.prepare('SELECT value FROM settings WHERE key = ?').get('organized_root') as { value: string } | undefined;
  if (rootRow && (rootRow.value === '""' || rootRow.value === '')) {
    const defaultRoot = path.join(os.homedir(), 'Documents', 'Organized').replace(/\\/g, '/');
    database.prepare('UPDATE settings SET value = ? WHERE key = ?').run(JSON.stringify(defaultRoot), 'organized_root');
    console.log(`[DB] Set default organized_root: ${defaultRoot}`);
  }

  // Seed managed folders if table is empty
  const folderCount = database.prepare('SELECT COUNT(*) as c FROM managed_folders').get() as { c: number };
  if (folderCount.c === 0) {
    const homedir = os.homedir().replace(/\\/g, '/');
    const defaultFolders = [
      { path: `${homedir}/Desktop`, label: 'Desktop' },
      { path: `${homedir}/Downloads`, label: 'Downloads' },
    ];

    const insert = database.prepare('INSERT OR IGNORE INTO managed_folders (path, label, watch_mode) VALUES (?, ?, ?)');
    for (const folder of defaultFolders) {
      if (fs.existsSync(folder.path.replace(/\//g, path.sep))) {
        insert.run(folder.path, folder.label, 'notify');
      }
    }
    console.log('[DB] Seeded default managed folders');
  }
}
