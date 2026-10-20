'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/gallery/video-player';
import { GlbViewer } from '@/components/gallery/glb-viewer';
import type { MediaItem } from '@/types/workflow';

interface ImageViewerProps {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function ImageViewer({ items, index, onClose, onIndexChange }: ImageViewerProps) {
  const item = items[index];
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndexChange(Math.max(0, index - 1));
      if (e.key === 'ArrowRight') onIndexChange(Math.min(items.length - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, items.length, onClose, onIndexChange]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between p-3 text-white">
        <div className="flex items-center gap-2">
          <p className="max-w-[40vw] truncate font-mono text-sm">{item.filename}</p>
          <span className="text-xs text-white/50">{index + 1} / {items.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {item.kind === 'image' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale((s) => Math.min(4, s * 1.25));
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale((s) => Math.max(0.5, s / 1.25));
                }}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </>
          )}
          <a
            href={item.url}
            download={item.filename}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md p-2 hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
          </a>
          <Button variant="ghost" size="icon" className="text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
        }}
        onMouseMove={(e) => {
          if (dragRef.current) {
            setPos({
              x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
              y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
            });
          }
        }}
        onMouseUp={() => (dragRef.current = null)}
        onMouseLeave={() => (dragRef.current = null)}
      >
        {item.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.filename}
            draggable={false}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              transition: dragRef.current ? 'none' : 'transform 0.15s',
            }}
            className="max-h-full max-w-full select-none"
          />
        ) : item.kind === 'video' ? (
          <div className="w-3/4 max-w-2xl">
            <VideoPlayer item={item} />
          </div>
        ) : item.kind === 'audio' ? (
          <div className="w-3/4 max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <audio src={item.url} controls autoPlay className="w-full" />
            <p className="mt-3 text-center text-xs text-white/60">{item.filename}</p>
          </div>
        ) : (
          <div className="h-[70vh] w-3/4 max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <GlbViewer url={item.url} alt={item.filename} className="h-full w-full" />
            <p className="mt-2 text-center text-xs text-white/60">
              拖曳旋轉・滾輪縮放（GLB 模型）
            </p>
          </div>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex justify-between p-3">
          <Button
            variant="ghost"
            className="text-white"
            onClick={() => onIndexChange(Math.max(0, index - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> 上一個
          </Button>
          <Button
            variant="ghost"
            className="text-white"
            onClick={() => onIndexChange(Math.min(items.length - 1, index + 1))}
          >
            下一個 <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}