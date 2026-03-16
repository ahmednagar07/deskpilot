import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
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
