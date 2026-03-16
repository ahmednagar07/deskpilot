import { create } from 'zustand';

export interface DriveInfo {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}

export interface ScanItem {
  id: number;
  drive_path: string;
  scan_type: string;
  item_path: string;
  size_bytes: number;
  is_approved: number;
  is_cleaned: number;
  scanned_at: string;
}

export interface ScanProgress {
  phase: string;
  current: number;
  total: number;
  currentPath?: string;
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
}

export interface DuplicateProgress {
  phase: string;
  current: number;
  total: number;
}

interface StorageState {
  drives: DriveInfo[];
  scanResults: ScanItem[];
  scanProgress: ScanProgress | null;
  isScanning: boolean;
  selectedItems: Set<number>;

  // Duplicate finder state
  duplicateGroups: DuplicateGroup[];
  isDuplicateScanning: boolean;
  duplicateProgress: DuplicateProgress | null;
  selectedDuplicates: Set<string>;

  setDrives: (drives: DriveInfo[]) => void;
  setScanResults: (results: ScanItem[]) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setIsScanning: (scanning: boolean) => void;
  toggleItem: (id: number) => void;
  selectAllOfType: (type: string) => void;
  deselectAll: () => void;
  removeCleanedItems: (ids: number[]) => void;

  // Duplicate finder methods
  setDuplicateGroups: (groups: DuplicateGroup[]) => void;
  setIsDuplicateScanning: (scanning: boolean) => void;
  setDuplicateProgress: (progress: DuplicateProgress | null) => void;
  toggleDuplicate: (filePath: string) => void;
  clearDuplicates: () => void;
}

export const useStorageStore = create<StorageState>((set, get) => ({
  drives: [],
  scanResults: [],
  scanProgress: null,
  isScanning: false,
  selectedItems: new Set(),

  // Duplicate finder
  duplicateGroups: [],
  isDuplicateScanning: false,
  duplicateProgress: null,
  selectedDuplicates: new Set(),

  setDrives: (drives) => set({ drives }),
  setScanResults: (results) => set({ scanResults: results }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
  setIsScanning: (scanning) => set({ isScanning: scanning }),

  toggleItem: (id) => {
    const selected = new Set(get().selectedItems);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    set({ selectedItems: selected });
  },

  selectAllOfType: (type) => {
    const selected = new Set(get().selectedItems);
    for (const item of get().scanResults) {
      if (item.scan_type === type) {
        selected.add(item.id);
      }
    }
    set({ selectedItems: selected });
  },

  deselectAll: () => set({ selectedItems: new Set() }),

  removeCleanedItems: (ids) => {
    const idSet = new Set(ids);
    set({
      scanResults: get().scanResults.filter(item => !idSet.has(item.id)),
      selectedItems: new Set([...get().selectedItems].filter(id => !idSet.has(id))),
    });
  },

  // Duplicate finder methods
  setDuplicateGroups: (groups) => set({ duplicateGroups: groups }),
  setIsDuplicateScanning: (scanning) => set({ isDuplicateScanning: scanning }),
  setDuplicateProgress: (progress) => set({ duplicateProgress: progress }),

  toggleDuplicate: (filePath) => {
    const selected = new Set(get().selectedDuplicates);
    if (selected.has(filePath)) {
      selected.delete(filePath);
    } else {
      selected.add(filePath);
    }
    set({ selectedDuplicates: selected });
  },

  clearDuplicates: () => set({
    duplicateGroups: [],
    selectedDuplicates: new Set(),
    duplicateProgress: null,
  }),
}));
