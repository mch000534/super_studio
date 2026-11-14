import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useGalleryStore } from '@/stores/gallery-store';
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

// 清理歷史記錄：只保留真正輸出到 output 資料夾的媒體。
// 過去收集過 type=input 的來源預覽（LoadVideo 的 UI 輸出），會讓畫廊
// 顯示未放大的來源影片；thumbnail 若指向被移除的項目則改用第一個保留項。
function sanitizeRecord(record: HistoryRecord): HistoryRecord {
  const media = (record.media || []).filter((m) => m.type === 'output');
  if (media.length === (record.media || []).length) return record;
  return { ...record, media, thumbnail: media[0]?.url || '' };
}

function sanitizeRecords(records: HistoryRecord[]): HistoryRecord[] {
  return records.map(sanitizeRecord).filter((r) => (r.media || []).length > 0);
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
          const clean = sanitizeRecord(record);
          const existing = dedupeRecords([clean, ...s.records]).slice(0, 500);
          return { records: existing };
        }),
      removeRecords: (ids) => {
        const all = useHistoryStore.getState().records;
        const removed = all.filter((r) => ids.includes(r.id));
        const remaining = all.filter((r) => !ids.includes(r.id));
        set({ records: remaining });
        const kept = new Set(remaining.flatMap((r) => r.media ?? []).map((m) => m.url));
        const orphans = [...new Set(removed.flatMap((r) => r.media ?? []).map((m) => m.url))].filter(
          (u) => !kept.has(u)
        );
        if (orphans.length > 0) useGalleryStore.getState().removeItems(orphans);
      },
      clear: () => {
        set({ records: [] });
        useGalleryStore.getState().clear();
      },
    }),
    {
      name: 'super-studio-history',
      merge: (persisted, current) => {
        const base = { ...current, ...(persisted as Partial<HistoryState>) };
        if (Array.isArray(base.records)) base.records = dedupeRecords(sanitizeRecords(base.records));
        return base as HistoryState;
      },
    }
  )
);
