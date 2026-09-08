'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHistoryStore } from '@/stores/history-store';
import { useSettingsStore } from '@/stores/settings-store';
import { MODES, getModeMeta } from '@/lib/modes';
import { toast } from '@/hooks/use-toast';

export default function HistoryPage() {
  const records = useHistoryStore((s) => s.records);
  const removeRecords = useHistoryStore((s) => s.removeRecords);
  const setMode = useSettingsStore((s) => s.setMode);
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = records;
    if (modeFilter !== 'all') list = list.filter((r) => r.mode === modeFilter);
    return [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [records, modeFilter]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReload = (id: string) => {
    const rec = records.find((r) => r.id === id);
    if (!rec) return;
    setMode(rec.mode);
    toast({ title: '已載入參數', description: `${getModeMeta(rec.mode).label} 模式參數已套用` });
  };

  const handleDelete = () => {
    if (selected.size === 0) return;
    removeRecords(Array.from(selected));
    setSelected(new Set());
    toast({ title: '已刪除', description: `移除了 ${selected.size} 筆記錄` });
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">歷史記錄</h1>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部模式</SelectItem>
              {MODES.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={selected.size === 0}>
            <Trash2 className="mr-1 h-4 w-4" /> 刪除
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          <p>尚無歷史記錄</p>
          <p className="mt-1 text-sm">完成一次生成後，結果與參數會自動記錄在這裡</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((rec) => (
            <li key={rec.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <input
                type="checkbox"
                checked={selected.has(rec.id)}
                onChange={() => toggle(rec.id)}
                className="h-4 w-4"
              />
              {rec.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rec.thumbnail} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <div className="h-12 w-12 rounded bg-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {rec.prompt || getModeMeta(rec.mode).label}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{getModeMeta(rec.mode).label}</Badge>
                  <span>{new Date(rec.timestamp).toLocaleString('zh-Hant')}</span>
                  <span>{rec.media.length} 個檔案</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleReload(rec.id)}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> 載入參數
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}