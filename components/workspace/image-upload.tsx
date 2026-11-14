'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, X, RefreshCw, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { comfyuiClient } from '@/lib/comfyui-client';
import { useSettingsStore } from '@/stores/settings-store';
import { useGalleryStore } from '@/stores/gallery-store';
import { getGalleryDragItem, hasGalleryDragData } from '@/lib/drag-drop';
import type { MediaItem } from '@/types/workflow';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_EXT = ['png', 'jpg', 'jpeg', 'webp'];
const ACCEPTED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const ACCEPTED_VIDEO_EXT = ['mp4', 'webm', 'mov', 'mkv', 'avi'];
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi)$/i;

interface ImageUploadProps {
  label: string;
  value: string | null;
  onChange: (data: { previewUrl: string; file: File | null } | null) => void;
  onUpload?: (file: File) => Promise<string>;
  onGalleryDrop?: (item: MediaItem) => void;
  expanded?: boolean;
  acceptVideo?: boolean;
}

export function ImageUpload({
  label,
  value,
  onChange,
  onUpload,
  onGalleryDrop,
  expanded = false,
  acceptVideo = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [galleryDragging, setGalleryDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<'image' | 'video' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { comfyuiHost, authHeader } = useSettingsStore();
  const fileAccept = acceptVideo
    ? '.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,.mkv,.avi'
    : '.png,.jpg,.jpeg,.webp';
  const galleryItem = useGalleryStore(
    (s) => (value ? s.items.find((i) => i.kind === 'image' && i.filename === value) : undefined)
  );
  const serverUrl = useMemo(() => {
    if (!value) return null;
    if (VIDEO_EXT.test(value) && !acceptVideo) return null;
    if (galleryItem?.url) return galleryItem.url;
    return comfyuiClient.getViewUrl(value, comfyuiHost, '', 'input', { authHeader });
  }, [value, galleryItem, comfyuiHost, authHeader, acceptVideo]);

  const handleFile = useCallback(
    async (file: File) => {
      const isVideoFile = file.type.startsWith('video/') || VIDEO_EXT.test(file.name);
      if (!acceptVideo && isVideoFile) {
        setError('僅支援 PNG / JPG / WEBP 格式');
        toast({ variant: 'destructive', title: '格式不支援', description: '請上傳 PNG、JPG 或 WEBP 圖片' });
        return;
      }
      if (acceptVideo && isVideoFile) {
        if (
          !ACCEPTED_VIDEO.includes(file.type) &&
          !ACCEPTED_VIDEO_EXT.some((e) => file.name.toLowerCase().endsWith(e))
        ) {
          setError('僅支援 MP4 / WEBM / MOV 格式');
          toast({ variant: 'destructive', title: '格式不支援', description: '請上傳 MP4、WEBM 或 MOV 影片' });
          return;
        }
      } else if (!ACCEPTED.includes(file.type) && !ACCEPTED_EXT.some((e) => file.name.toLowerCase().endsWith(e))) {
        setError('僅支援 PNG / JPG / WEBP 格式');
        toast({ variant: 'destructive', title: '格式不支援', description: '請上傳 PNG、JPG 或 WEBP 圖片' });
        return;
      }
      setError(null);
      if (preview) URL.revokeObjectURL(preview);
      const objectUrl = URL.createObjectURL(file);
      const kind = isVideoFile ? 'video' : 'image';
      setPreviewKind(kind);
      try {
        setUploading(true);
        if (onUpload) {
          const name = await onUpload(file);
          onChange({ previewUrl: objectUrl, file: null });
          setPreview(objectUrl);
          toast({ title: '已上傳', description: `${label}已上傳：${name}` });
        } else {
          onChange({ previewUrl: objectUrl, file });
          setPreview(objectUrl);
        }
      } catch {
        URL.revokeObjectURL(objectUrl);
        setError('上傳失敗，請確認 ComfyUI 已連接');
        toast({ variant: 'destructive', title: '上傳失敗' });
      } finally {
        setUploading(false);
      }
    },
    [label, onChange, onUpload, preview, acceptVideo]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const item = getGalleryDragItem(e.dataTransfer);
      if (item && onGalleryDrop) {
        onGalleryDrop(item);
        return;
      }
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile, onGalleryDrop]
  );

  const dragHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
      setGalleryDragging(hasGalleryDragData(e.dataTransfer));
    },
    onDragLeave: () => {
      setDragging(false);
      setGalleryDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      setGalleryDragging(false);
      handleDrop(e);
    },
  };

  const dropZoneClass = cn(
    'border-2 border-dashed transition-colors',
    galleryDragging
      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
      : dragging
        ? 'border-primary bg-primary/5'
        : 'border-border'
  );

  const url = preview || serverUrl;

  if (url) {
    const isVideo = previewKind === 'video' || (acceptVideo && VIDEO_EXT.test(url));
    return (
      <div className="space-y-2">
        <Label small>{label}</Label>
        <div
          {...dragHandlers}
          className={cn('relative overflow-hidden rounded-md border', galleryDragging || dragging ? 'ring-2 ring-primary/30' : '')}
        >
          {isVideo ? (
            <video
              src={url}
              muted
              preload="metadata"
              className={cn('w-full object-cover', expanded ? 'h-40' : 'h-28')}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} className={cn('w-full object-cover', expanded ? 'h-40' : 'h-28')} />
          )}
          <div className="absolute right-1 top-1 flex gap-1">
            <button
              onClick={() => {
                if (inputRef.current) inputRef.current.value = '';
                inputRef.current?.click();
              }}
              className="rounded-md bg-background/80 p-1 hover:bg-background"
              title="更換"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
                setPreviewKind(null);
                setError(null);
                if (inputRef.current) inputRef.current.value = '';
                onChange(null);
              }}
              className="rounded-md bg-background/80 p-1 hover:bg-background"
              title="移除"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={fileAccept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) handleFile(f);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label small>{label}</Label>
      <div
        onClick={() => inputRef.current?.click()}
        {...dragHandlers}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md p-4 text-center transition-colors',
          dropZoneClass,
          uploading ? 'animate-pulse opacity-60' : ''
        )}
      >
        {uploading ? (
          <p className="text-xs text-muted-foreground">上傳中…</p>
        ) : galleryDragging ? (
          <>
            <Upload className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-primary">放開以使用畫廊素材</p>
            <p className="text-xs text-muted-foreground/70">
              或點擊{acceptVideo ? '上傳影片' : '上傳圖片'}
            </p>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{acceptVideo ? '點擊或拖放影片' : '點擊或拖放圖片'}</p>
            <p className="text-xs text-muted-foreground/70">
              {acceptVideo ? '支援 MP4 / WEBM / MOV' : '支援 PNG / JPG / WEBP'}
            </p>
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={fileAccept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

function Label({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <p className={cn('text-sm font-medium', small && 'text-xs text-muted-foreground')}>{children}</p>
  );
}

export function VideoUploadSource({ label, value, onChange, expanded = false }: Omit<ImageUploadProps, 'onUpload'>) {
  return <ImageUpload label={label} value={value} onChange={onChange} expanded={expanded} />;
}

export { ImageIcon };