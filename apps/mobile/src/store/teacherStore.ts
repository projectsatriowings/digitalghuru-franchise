import { create } from 'zustand';
import { TeacherBatchItem } from '../types/teacher';

interface TeacherState {
  batches: TeacherBatchItem[];
  selectedBatch: TeacherBatchItem | null;
  setBatches: (batches: TeacherBatchItem[]) => void;
  setSelectedBatch: (batch: TeacherBatchItem) => void;
  selectBatchById: (batchId: string) => void;
  clearTeacherSession: () => void;
}

export const useTeacherStore = create<TeacherState>((set, get) => ({
  batches: [],
  selectedBatch: null,

  setBatches: (batches: TeacherBatchItem[]) => {
    const current = get().selectedBatch;
    const matching = batches.find((b) => b.id === current?.id);
    set({
      batches,
      selectedBatch: matching || (batches.length > 0 ? batches[0] : null),
    });
  },

  setSelectedBatch: (batch: TeacherBatchItem) => {
    set({ selectedBatch: batch });
  },

  selectBatchById: (batchId: string) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (batch) {
      set({ selectedBatch: batch });
    }
  },

  clearTeacherSession: () => {
    set({
      batches: [],
      selectedBatch: null,
    });
  },
}));
