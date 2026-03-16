import { create } from 'zustand';
import { ScanProgress } from '../../shared/types';

export interface ScannedFile {
  id: number;
  original_path: string;
  current_path: string;
  filename: string;
  extension: string | null;
  size_bytes: number;
  category_id: number | null;
  classification_method: 'rule' | 'gemini' | 'manual' | null;
  classification_confidence: number | null;
  is_organized: boolean;
  category_name?: string;
  category_slug?: string;
  category_color?: string;
}

export interface ScanResult {
  totalDiscovered: number;
  ruleClassified: number;
  geminiClassified: number;
  unclassified: number;
  needsReview: number;
  errors: string[];
}

export interface ReviewItem {
  filePath: string;
  filename: string;
  aiThinking: string;
  bestGuess: string;
  bestGuessConfidence: number;
  alternatives: Array<{ slug: string; reason: string }>;
  question: string;
}

interface ScanState {
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  scanResult: ScanResult | null;
  files: ScannedFile[];
  selectedFolders: string[];
  useGemini: boolean;
  hasGeminiKey: boolean;
  reviewItems: ReviewItem[];

  setIsScanning: (v: boolean) => void;
  setScanProgress: (p: ScanProgress | null) => void;
  setScanResult: (r: ScanResult | null) => void;
  setFiles: (f: ScannedFile[]) => void;
  setSelectedFolders: (folders: string[]) => void;
  toggleFolder: (path: string) => void;
  setUseGemini: (v: boolean) => void;
  setHasGeminiKey: (v: boolean) => void;
  setReviewItems: (items: ReviewItem[]) => void;
  removeReviewItem: (filePath: string) => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
  isScanning: false,
  scanProgress: null,
  scanResult: null,
  files: [],
  selectedFolders: [],
  useGemini: false,
  hasGeminiKey: false,
  reviewItems: [],

  setIsScanning: (v) => set({ isScanning: v }),
  setScanProgress: (p) => set({ scanProgress: p }),
  setScanResult: (r) => set({ scanResult: r }),
  setFiles: (f) => set({ files: f }),
  setSelectedFolders: (folders) => set({ selectedFolders: folders }),
  toggleFolder: (path) => {
    const current = get().selectedFolders;
    if (current.includes(path)) {
      set({ selectedFolders: current.filter(f => f !== path) });
    } else {
      set({ selectedFolders: [...current, path] });
    }
  },
  setUseGemini: (v) => set({ useGemini: v }),
  setHasGeminiKey: (v) => set({ hasGeminiKey: v }),
  setReviewItems: (items) => set({ reviewItems: items }),
  removeReviewItem: (filePath) => set({
    reviewItems: get().reviewItems.filter(ri => ri.filePath !== filePath),
  }),
}));
