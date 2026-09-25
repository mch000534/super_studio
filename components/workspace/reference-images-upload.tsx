'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { comfyuiClient } from '@/lib/comfyui-client';
import { useSettingsStore } from '@/stores/settings-store';
import { getGalleryDragItem, hasGalleryDragData } from '@/lib/drag-drop';
import type { MediaItem } from '@/types/workflow';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_EXT = ['png', 'jpg', 'jpeg', 'webp'];

interface ReferenceImagesUploadProps {
  values: string[];
  onChange: (values: string[]) => void;
  onUpload: (file: File) => Promise<string>;
  onGalleryPick: (item: MediaItem) => Promise<string>;
  onTileClick?: (index: number) => void;
  max?: number;
  hint?: string;
}

export function ReferenceImagesUpload({
  values,
  onChange,
  onUpload,
  onGalleryPick,
  onTileClick,
  max = 10,
  hint,
}: ReferenceImagesUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [galleryDragging, setGalleryDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { comfyuiHost, authHeader } = useSettingsStore();

  const urls = useMemo(
    () =>
      values.map((name) =>
        comfyuiClient.getViewUrl(name, comfyuiHost, '', 'input', { authHeader })
      ),
    [values, comfyuiHost, authHeader]
  );

  const applyName = async (file?: File, item?: MediaItem): Promise<string | null> => {
    try {
      return file ? await onUpload(file) : await onGalleryPick(item!);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '加入失敗',
        description: e instanceof Error ? e.message : '無法加入參考圖',
      });
      return null;
    }
  };

  const handleFile = async (file: File) => {
    const isSupported =
      ACCEPTED.includes(file.type) || ACCEPTED_EXT.some((e) => file.name.toLowerCase().endsWith(e));
    if (!isSupported || file.type.startsWith('video/')) {
      toast({ variant: 'destructive', title: '格式不支援', description: '請上傳 PNG / JPG / WEBP 圖片' });
      setPendingIndex(null);
      return;
    }
    setUploading(true);
    try {
      const name = await applyName(file);
      if (!name) return;
      if (pendingIndex === null) {
        onChange([...values, name]);
      } else {
        onChange(values.map((v, i) => (i === pendingIndex ? name : v)));
      }
    } finally {
      setUploading(false);
      setPendingIndex(null);
    }
  };

  const dropOnIndex = async (index: number | null, dt: DataTransfer) => {
    const item = getGalleryDragItem(dt);
    if (item) {
      const name = await applyName(undefined, item);
      if (!name) return;
      if (index === null) onChange([...values, name]);
      else onChange(values.map((v, i) => (i === index ? name : v)));
      return;
    }
    const f = dt.files?.[0];
    if (f) {
      setPendingIndex(index);
      await handleFile(f);
    }
  };

  const tileDragHandlers = (index: number) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverIndex(index);
      setGalleryDragging(hasGalleryDragData(e.dataTransfer));
    },
    onDragLeave: () => {
      setDragOverIndex(null);
      setGalleryDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverIndex(null);
      setGalleryDragging(false);
      dropOnIndex(index, e.dataTransfer);
    },
  });

  const addDragHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setGalleryDragging(hasGalleryDragData(e.dataTransfer));
    },
    onDragLeave: () => setGalleryDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setGalleryDragging(false);
      dropOnIndex(null, e.dataTransfer);
    },
  };

  return (
    <div className="space-y-2">
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="grid grid-cols-5 gap-2">
        {values.map((name, i) => (
          <div
            key={`${name}-${i}`}
            {...tileDragHandlers(i)}
            onClick={() => onTileClick?.(i)}
            className={cn(
              'relative overflow-hidden rounded-md border',
              onTileClick ? 'cursor-pointer' : '',
              dragOverIndex === i ? 'ring-2 ring-primary/30' : ''
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urls[i]}
              alt={`參考圖 ${i + 1}`}
              className="aspect-square w-full object-cover"
            />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] leading-4 text-white">
              {i + 1}
            </span>
            <div className="absolute right-1 top-1 flex gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingIndex(i);
                  inputRef.current?.click();
                }}
                className="rounded bg-black/60 p-0.5 text-white hover:bg-black/80"
                title="更換"
                type="button"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(values.filter((_, idx) => idx !== i));
                }}
                className="rounded bg-black/60 p-0.5 text-white hover:bg-black/80"
                title="移除"
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}

        {values.length < max && (
          <div
            onClick={() => {
              if (uploading) return;
              setPendingIndex(null);
              inputRef.current?.click();
            }}
            {...addDragHandlers}
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-center transition-colors',
              'cursor-pointer border-border',
              galleryDragging
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                : 'hover:border-primary/60',
              uploading ? 'animate-pulse opacity-60' : ''
            )}
            title="上傳參考圖"
          >
            {uploading ? (
              <span className="text-[10px] text-muted-foreground">上傳中…</span>
            ) : (
              <>
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  新增 ({values.length}/{max})
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}