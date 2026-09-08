import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryRecord } from '@/types/workflow';

interface HistoryState {
  records: HistoryRecord[];
  addRecord: (record: HistoryRecord) => void;
  removeRecords: (ids: string[]) => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (record) =>
        set((s) => ({ records: [record, ...s.records].slice(0, 500) })),
      removeRecords: (ids) =>
        set((s) => ({ records: s.records.filter((r) => !ids.includes(r.id)) })),
      clear: () => set({ records: [] }),
    }),
    { name: 'super-studio-history' }
  )
);
