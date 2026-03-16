import { create } from 'zustand';
import { MovePlanItem } from '../../shared/types';

export interface UndoSession {
  session_id: string;
  count: number;
  executed_at: string;
}

interface OrganizerState {
  plan: MovePlanItem[];
  isGenerating: boolean;
  isExecuting: boolean;
  undoHistory: UndoSession[];

  setPlan: (plan: MovePlanItem[]) => void;
  setIsGenerating: (v: boolean) => void;
  setIsExecuting: (v: boolean) => void;
  setUndoHistory: (h: UndoSession[]) => void;
  toggleApproval: (fileId: number) => void;
  approveAll: () => void;
  deselectAll: () => void;
  updateDestPath: (fileId: number, newDest: string) => void;
}

export const useOrganizerStore = create<OrganizerState>((set, get) => ({
  plan: [],
  isGenerating: false,
  isExecuting: false,
  undoHistory: [],

  setPlan: (plan) => set({ plan }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsExecuting: (v) => set({ isExecuting: v }),
  setUndoHistory: (h) => set({ undoHistory: h }),

  toggleApproval: (fileId) => {
    set({
      plan: get().plan.map(item =>
        item.fileId === fileId ? { ...item, approved: !item.approved } : item
      ),
    });
  },

  approveAll: () => {
    set({ plan: get().plan.map(item => ({ ...item, approved: true })) });
  },

  deselectAll: () => {
    set({ plan: get().plan.map(item => ({ ...item, approved: false })) });
  },

  updateDestPath: (fileId, newDest) => {
    set({
      plan: get().plan.map(item =>
        item.fileId === fileId ? { ...item, destPath: newDest } : item
      ),
    });
  },
}));
