'use client';

import { Download, Maximize2, ArrowUpDown, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setGalleryDragData } from '@/lib/drag-drop';
import type { MediaItem } from '@/types/workflow';

interface MediaCardProps {
  item: MediaItem;
  onOpen: (item: MediaItem) => void;
  onUpscale: (item: MediaItem) => void;
}

export function MediaCard({ item, onOpen, onUpscale }: MediaCardProps) {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.filename;
    a.click();
  };

  const handleDragStart = (e: React.DragEvent) => {
    setGalleryDragData(e.dataTransfer, item);
  };

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg border bg-card"
      draggable
      onDragStart={handleDragStart}
      onClick={() => onOpen(item)}
    >
      {item.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.filename}
          loading="lazy"
          className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
      ) : item.kind === 'video' ? (
        <video
          src={item.url}
          muted
          preload="metadata"
          className="aspect-square w-full object-cover"
        />
      ) : item.kind === 'audio' ? (
        <div className="flex aspect-square w-full items-center justify-center bg-secondary/50 p-3">
          <audio
            src={item.url}
            controls
            preload="metadata"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="w-full"
          />
        </div>
      ) : (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-secondary/50 p-3 text-center">
          <Box className="h-10 w-10 text-muted-foreground/60" />
          <span className="break-all px-1 text-[11px] text-muted-foreground">{item.filename}</span>
        </div>
      )}

      {item.isUpscaled && (
        <span className="absolute left-1 top-1 rounded bg-success/90 px-1.5 py-0.5 text-[10px] font-medium text-success-foreground">
          HD
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 transition-transform group-hover:translate-y-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={handleDownload} title="下載">
          <Download className="h-3.5 w-3.5" />
        </Button>
        {(item.kind === 'image' || item.kind === 'video') && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white"
            onClick={(e) => {
              e.stopPropagation();
              onUpscale(item);
            }}
            title="放大"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white" title="放大檢視">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}