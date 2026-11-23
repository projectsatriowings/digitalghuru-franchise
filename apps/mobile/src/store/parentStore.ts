import { create } from 'zustand';
import { ParentChildSummary } from '../types/parent';

interface ParentState {
  children: ParentChildSummary[];
  selectedChild: ParentChildSummary | null;
  setChildren: (children: ParentChildSummary[]) => void;
  setSelectedChild: (child: ParentChildSummary) => void;
  selectChildById: (studentId: string) => void;
  clearParentSession: () => void;
}

export const useParentStore = create<ParentState>((set, get) => ({
  children: [],
  selectedChild: null,

  setChildren: (children: ParentChildSummary[]) => {
    const currentSelected = get().selectedChild;
    // Retain currently selected child if still valid, otherwise default to first child
    const matchingSelected = children.find(c => c.studentId === currentSelected?.studentId);
    set({
      children,
      selectedChild: matchingSelected || (children.length > 0 ? children[0] : null),
    });
  },

  setSelectedChild: (child: ParentChildSummary) => {
    set({ selectedChild: child });
  },

  selectChildById: (studentId: string) => {
    const child = get().children.find(c => c.studentId === studentId);
    if (child) {
      set({ selectedChild: child });
    }
  },

  clearParentSession: () => {
    set({
      children: [],
      selectedChild: null,
    });
  },
}));
