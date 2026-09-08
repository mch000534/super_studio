'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, X, RefreshCw, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { comfyuiClient } from '@/lib/comfyui-client';
import { useSettingsStore } from '@/stores/settings-store';
import { useGalleryStore } from '@/stores/gallery-store';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_EXT = ['png', 'jpg', 'jpeg', 'webp'];

interface ImageUploadProps {
  label: string;
  value: string | null;
  onChange: (data: { previewUrl: string; file: File | null } | null) => void;
  onUpload?: (file: File) => Promise<string>;
  expanded?: boolean;
}

export function ImageUpload({ label, value, onChange, onUpload, expanded = false }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { comfyuiHost, authHeader } = useSettingsStore();
  const galleryItem = useGalleryStore(
    (s) => (value ? s.items.find((i) => i.kind === 'image' && i.filename === value) : undefined)
  );
  const serverUrl = useMemo(() => {
    if (!value) return null;
    if (galleryItem?.url) return galleryItem.url;
    return comfyuiClient.getViewUrl(value, comfyuiHost, '', 'input', { authHeader });
  }, [value, galleryItem, comfyuiHost, authHeader]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED.includes(file.type) && !ACCEPTED_EXT.some((e) => file.name.toLowerCase().endsWith(e))) {
        setError('僅支援 PNG / JPG / WEBP 格式');
        toast({ variant: 'destructive', title: '格式不支援', description: '請上傳 PNG、JPG 或 WEBP 圖片' });
        return;
      }
      setError(null);
      if (preview) URL.revokeObjectURL(preview);
      const objectUrl = URL.createObjectURL(file);
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
    [label, onChange, onUpload, preview]
  );

  const url = preview || serverUrl;

  if (url) {
    return (
      <div className="space-y-2">
        <Label small>{label}</Label>
        <div className="relative overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className={cn('w-full object-cover', expanded ? 'h-40' : 'h-28')} />
          <div className="absolute right-1 top-1 flex gap-1">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-md bg-background/80 p-1 hover:bg-background"
              title="更換"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
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
          accept=".png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
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
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border',
          uploading ? 'animate-pulse opacity-60' : ''
        )}
      >
        {uploading ? (
          <p className="text-xs text-muted-foreground">上傳中…</p>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">點擊或拖放圖片</p>
            <p className="text-xs text-muted-foreground/70">支援 PNG / JPG / WEBP</p>
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
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