-- DeskPilot initial schema

-- File categories
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  icon        TEXT,
  color       TEXT,
  target_path TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Seed categories
INSERT INTO categories (name, slug, icon, color, target_path, sort_order) VALUES
  ('Clients',    'clients',    'briefcase',      '#3B82F6', 'Clients',    1),
  ('Projects',   'projects',   'code',           '#8B5CF6', 'Projects',   2),
  ('Medicine',   'medicine',   'heart-pulse',    '#EF4444', 'Medicine',   3),
  ('Design',     'design',     'palette',        '#F59E0B', 'Design',     4),
  ('Learning',   'learning',   'graduation-cap', '#10B981', 'Learning',   5),
  ('Documents',  'documents',  'file-text',      '#6B7280', 'Documents',  6),
  ('Media',      'media',      'image',          '#EC4899', 'Media',      7),
  ('Tools',      'tools',      'wrench',         '#14B8A6', 'Tools',      8),
  ('Archive',    'archive',    'archive',        '#9CA3AF', 'Archive',    9);

-- Every file DeskPilot knows about
CREATE TABLE IF NOT EXISTS tracked_files (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  original_path             TEXT NOT NULL,
  current_path              TEXT NOT NULL UNIQUE,
  filename                  TEXT NOT NULL,
  extension                 TEXT,
  size_bytes                INTEGER NOT NULL DEFAULT 0,
  hash_md5                  TEXT,
  category_id               INTEGER REFERENCES categories(id),
  classification_method     TEXT,
  classification_confidence REAL,
  is_organized              INTEGER NOT NULL DEFAULT 0,
  discovered_at             TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at               TEXT,
  indexed_at                TEXT
);

CREATE INDEX IF NOT EXISTS idx_tracked_files_current_path ON tracked_files(current_path);
CREATE INDEX IF NOT EXISTS idx_tracked_files_category ON tracked_files(category_id);
CREATE INDEX IF NOT EXISTS idx_tracked_files_extension ON tracked_files(extension);
CREATE INDEX IF NOT EXISTS idx_tracked_files_filename ON tracked_files(filename);

-- Classification rules
CREATE TABLE IF NOT EXISTS classification_rules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  rule_type    TEXT NOT NULL,
  rule_value   TEXT NOT NULL,
  priority     INTEGER NOT NULL DEFAULT 100,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed classification rules
-- Extension-based rules (high priority for specific types)
INSERT INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  -- Design files
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.psd',     10),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.ai',      10),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.fig',     10),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.sketch',  10),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.xd',      10),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.indd',    10),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.svg',     20),

  -- Media - Video
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.mp4',     10),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.mkv',     10),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.avi',     10),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.mov',     10),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.wmv',     10),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.mp3',     10),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.wav',     10),

  -- Media - Images (lower priority, can be overridden)
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.jpg',     50),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.jpeg',    50),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.png',     50),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.gif',     50),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.webp',    50),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.avif',    50),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.jfif',    50),

  -- Documents (generic, lower priority)
  ((SELECT id FROM categories WHERE slug='documents'), 'extension', '.pdf',   60),
  ((SELECT id FROM categories WHERE slug='documents'), 'extension', '.docx',  60),
  ((SELECT id FROM categories WHERE slug='documents'), 'extension', '.doc',   60),
  ((SELECT id FROM categories WHERE slug='documents'), 'extension', '.xlsx',  60),
  ((SELECT id FROM categories WHERE slug='documents'), 'extension', '.xls',   60),
  ((SELECT id FROM categories WHERE slug='documents'), 'extension', '.pptx',  60),
  ((SELECT id FROM categories WHERE slug='documents'), 'extension', '.ppt',   60),
  ((SELECT id FROM categories WHERE slug='documents'), 'extension', '.csv',   60),
  ((SELECT id FROM categories WHERE slug='documents'), 'extension', '.txt',   60),

  -- Code / Projects
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.ts',     70),
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.tsx',    70),
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.js',     70),
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.jsx',    70),
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.py',     70),
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.html',   70),
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.css',    70),
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.php',    70),
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.json',   80),
  ((SELECT id FROM categories WHERE slug='projects'), 'extension', '.sql',    80),

  -- Tools / Installers
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.exe',     30),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.msi',     30),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.zip',     40),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.rar',     40),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.7z',      40),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.iso',     30),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.torrent', 40),

  -- Fonts (sub-design)
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.ttf',    20),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.otf',    20),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.woff',   20),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.woff2',  20);

-- Path-based rules (for known client/project folders)
INSERT INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'LOC',        5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'Banan',      5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'TechAqar',   5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'StayCity',   5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'Yakz',       5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'Entiqa',     5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'MacSoft',    5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'Wessal',     5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'Thrall Hub', 5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'InBots',     5),
  ((SELECT id FROM categories WHERE slug='clients'), 'path_contains', 'Aleen',      5),

  ((SELECT id FROM categories WHERE slug='projects'), 'path_contains', 'Clawdbot',   5),
  ((SELECT id FROM categories WHERE slug='projects'), 'path_contains', 'InMind',     5),
  ((SELECT id FROM categories WHERE slug='projects'), 'path_contains', 'InBooks',    5),
  ((SELECT id FROM categories WHERE slug='projects'), 'path_contains', 'MegaMind',   5),
  ((SELECT id FROM categories WHERE slug='projects'), 'path_contains', 'Numi',       5),
  ((SELECT id FROM categories WHERE slug='projects'), 'path_contains', 'InField',    5),
  ((SELECT id FROM categories WHERE slug='projects'), 'path_contains', 'InLearn',    5),
  ((SELECT id FROM categories WHERE slug='projects'), 'path_contains', 'iLearn',     5),

  ((SELECT id FROM categories WHERE slug='learning'), 'path_contains', 'College',    5),
  ((SELECT id FROM categories WHERE slug='learning'), 'path_contains', 'Course',     5),
  ((SELECT id FROM categories WHERE slug='learning'), 'path_contains', 'StudY',      5),
  ((SELECT id FROM categories WHERE slug='learning'), 'path_contains', 'HTML EL Zero', 5),
  ((SELECT id FROM categories WHERE slug='learning'), 'path_contains', 'Front Course', 5),

  ((SELECT id FROM categories WHERE slug='media'), 'path_contains', 'Screenshots',   15),
  ((SELECT id FROM categories WHERE slug='media'), 'path_contains', 'Photosession',  15),

  ((SELECT id FROM categories WHERE slug='design'), 'path_contains', 'Fonts',        15);

-- Move log for undo support
CREATE TABLE IF NOT EXISTS move_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id       INTEGER NOT NULL REFERENCES tracked_files(id),
  source_path   TEXT NOT NULL,
  dest_path     TEXT NOT NULL,
  old_filename  TEXT,
  new_filename  TEXT,
  session_id    TEXT NOT NULL,
  operation     TEXT NOT NULL DEFAULT 'move',
  is_undone     INTEGER NOT NULL DEFAULT 0,
  executed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  undone_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_move_log_session ON move_log(session_id);
CREATE INDEX IF NOT EXISTS idx_move_log_file ON move_log(file_id);

-- Storage scan results
CREATE TABLE IF NOT EXISTS storage_scans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  drive_path   TEXT NOT NULL,
  scan_type    TEXT NOT NULL,
  item_path    TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  is_approved  INTEGER NOT NULL DEFAULT 0,
  is_cleaned   INTEGER NOT NULL DEFAULT 0,
  scanned_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Key-value settings
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('organized_root',            '"G:/hard/Work"'),
  ('large_file_threshold_mb',   '500'),
  ('scan_depth',                '10'),
  ('launch_on_startup',         'false'),
  ('search_hotkey',             '"CommandOrControl+Space"'),
  ('theme',                     '"dark"'),
  ('notification_enabled',      'true'),
  ('digest_day',                '"sunday"'),
  ('auto_organize_confidence',  '0.9');

-- Managed folders
CREATE TABLE IF NOT EXISTS managed_folders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT NOT NULL UNIQUE,
  label       TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  watch_mode  TEXT NOT NULL DEFAULT 'notify',
  added_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default managed folders
INSERT INTO managed_folders (path, label, watch_mode) VALUES
  ('C:/Users/Nagar.DESKTOP-KI2BE5D/Desktop',              'Desktop',      'notify'),
  ('C:/Users/Nagar.DESKTOP-KI2BE5D/Downloads',             'Downloads',    'notify'),
  ('G:/hard/Work',                                          'Work (G:)',    'notify'),
  ('C:/Users/Nagar.DESKTOP-KI2BE5D/OneDrive/Desktop/Work', 'OneDrive Work','notify');
