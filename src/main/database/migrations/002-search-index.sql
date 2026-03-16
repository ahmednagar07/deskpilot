-- Full-text search index for instant file search

CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
  filename,
  current_path,
  category_name,
  extension,
  content='tracked_files',
  content_rowid='id',
  tokenize='unicode61'
);

-- Triggers to keep FTS in sync with tracked_files

CREATE TRIGGER IF NOT EXISTS tracked_files_ai AFTER INSERT ON tracked_files BEGIN
  INSERT INTO files_fts(rowid, filename, current_path, category_name, extension)
  SELECT NEW.id, NEW.filename, NEW.current_path,
         COALESCE((SELECT name FROM categories WHERE id = NEW.category_id), ''),
         COALESCE(NEW.extension, '');
END;

CREATE TRIGGER IF NOT EXISTS tracked_files_ad AFTER DELETE ON tracked_files BEGIN
  INSERT INTO files_fts(files_fts, rowid, filename, current_path, category_name, extension)
  VALUES('delete', OLD.id, OLD.filename, OLD.current_path,
         COALESCE((SELECT name FROM categories WHERE id = OLD.category_id), ''),
         COALESCE(OLD.extension, ''));
END;

CREATE TRIGGER IF NOT EXISTS tracked_files_au AFTER UPDATE ON tracked_files BEGIN
  INSERT INTO files_fts(files_fts, rowid, filename, current_path, category_name, extension)
  VALUES('delete', OLD.id, OLD.filename, OLD.current_path,
         COALESCE((SELECT name FROM categories WHERE id = OLD.category_id), ''),
         COALESCE(OLD.extension, ''));
  INSERT INTO files_fts(rowid, filename, current_path, category_name, extension)
  SELECT NEW.id, NEW.filename, NEW.current_path,
         COALESCE((SELECT name FROM categories WHERE id = NEW.category_id), ''),
         COALESCE(NEW.extension, '');
END;
