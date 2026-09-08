'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useGalleryStore } from '@/stores/gallery-store';
import type { MediaKind } from '@/types/workflow';

interface SourcePickerProps {
  kind: MediaKind;
  onSelect: (name: string) => void;
}

export function SourcePicker({ kind, onSelect }: SourcePickerProps) {
  const items = useGalleryStore((s) => s.items);
  const [selected, setSelected] = useState<string | null>(null);
  const candidates = items.filter((i) => i.kind === kind);

  if (candidates.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label>來源媒體</Label>
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          畫廊尚無{kind === 'image' ? '圖片' : '影片'}，請先上傳或選擇
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>來源媒體（從畫廊選擇）</Label>
      <div className="grid grid-cols-3 gap-1">
        {candidates.slice(0, 6).map((item) => {
          const active = selected === item.filename;
          return (
            <button
              key={item.url}
              onClick={() => {
                setSelected(item.filename);
                onSelect(item.filename);
              }}
              className={cn(
                'relative overflow-hidden rounded-md border',
                active ? 'border-primary ring-2 ring-primary' : 'border-border'
              )}
            >
              {kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <video src={item.url} className="aspect-square w-full object-cover" muted />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}