export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  target_path: string;
  sort_order: number;
}

export interface TrackedFile {
  id: number;
  original_path: string;
  current_path: string;
  filename: string;
  extension: string | null;
  size_bytes: number;
  hash_md5: string | null;
  category_id: number | null;
  classification_method: 'rule' | 'gemini' | 'manual' | null;
  classification_confidence: number | null;
  is_organized: boolean;
  discovered_at: string;
  modified_at: string | null;
  indexed_at: string | null;
}

export interface MoveLogEntry {
  id: number;
  file_id: number;
  source_path: string;
  dest_path: string;
  old_filename: string | null;
  new_filename: string | null;
  session_id: string;
  operation: 'move' | 'rename' | 'delete';
  is_undone: boolean;
  executed_at: string;
  undone_at: string | null;
}

export interface StorageScanItem {
  id: number;
  drive_path: string;
  scan_type: 'temp' | 'cache' | 'node_modules' | 'duplicates' | 'large_files';
  item_path: string;
  size_bytes: number;
  is_approved: boolean;
  is_cleaned: boolean;
  scanned_at: string;
}

export interface ManagedFolder {
  id: number;
  path: string;
  label: string | null;
  is_active: boolean;
  watch_mode: 'notify' | 'auto' | 'ignore';
  added_at: string;
}

export interface ClassificationResult {
  file: TrackedFile;
  categoryId: number;
  method: 'rule' | 'gemini' | 'manual';
  confidence: number;
  reason?: string;
}

export interface MovePlanItem {
  fileId: number;
  currentPath: string;
  destPath: string;
  currentName: string;
  suggestedName: string | null;
  category: string;
  approved: boolean;
}

export interface ScanProgress {
  phase: string;
  current: number;
  total: number;
  currentPath?: string;
}

export interface StorageSummary {
  drivePath: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}

// Preload API exposed to renderer
export interface DeskPilotApi {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    api: DeskPilotApi;
  }
}
