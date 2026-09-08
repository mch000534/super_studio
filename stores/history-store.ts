import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryRecord } from '@/types/workflow';

function recordSignature(record: HistoryRecord): string {
  const files = (record.media || [])
    .map((m) => `${m.kind}|${m.filename}|${m.subfolder}|${m.type}`)
    .sort()
    .join('::');
  if (files) return `files:${files}`;
  return JSON.stringify([
    record.mode,
    record.prompt,
    Math.floor(new Date(record.timestamp).getTime() / 1000),
  ]);
}

function dedupeRecords(records: HistoryRecord[]): HistoryRecord[] {
  const seen = new Set<string>();
  return records.filter((r) => {
    const sig = recordSignature(r);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

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
        set((s) => {
          const existing = dedupeRecords([record, ...s.records]).slice(0, 500);
          return { records: existing };
        }),
      removeRecords: (ids) =>
        set((s) => ({ records: s.records.filter((r) => !ids.includes(r.id)) })),
      clear: () => set({ records: [] }),
    }),
    {
      name: 'super-studio-history',
      merge: (persisted, current) => {
        const base = { ...current, ...(persisted as Partial<HistoryState>) };
        if (Array.isArray(base.records)) base.records = dedupeRecords(base.records);
        return base as HistoryState;
      },
    }
  )
);
