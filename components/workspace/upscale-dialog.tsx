'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
import { useGenerationStore } from '@/stores/generation-store';
import { comfyuiClient } from '@/lib/comfyui-client';
import { toast } from '@/hooks/use-toast';
import type { MediaItem } from '@/types/workflow';

let lastUpscaleSourceUrl: string | null = null;

export function getUpscaleSourceUrl(): string | null {
  return lastUpscaleSourceUrl;
}

export function setUpscaleSourceUrl(url: string | null): void {
  lastUpscaleSourceUrl = url;
}

export function clearUpscaleSourceUrl(): void {
  lastUpscaleSourceUrl = null;
}

interface UpscaleDialogProps {
  target: MediaItem | null;
  onClose: () => void;
}

export function UpscaleDialog({ target, onClose }: UpscaleDialogProps) {
  const { comfyuiHost, authHeader } = useSettingsStore();
  const setMode = useSettingsStore((s) => s.setMode);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const [scale, setScale] = useState(2);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  if (!target) return null;

  const handleConfirm = async () => {
    setPreparing(true);
    try {
      const res = await fetch(target.url);
      const blob = await res.blob();
      const file = new File([blob], target.filename, { type: blob.type });
      const ext = target.kind === 'image' ? 'image' : 'video';
      const upload =
        ext === 'image'
          ? comfyuiClient.uploadImage(file, comfyuiHost, authHeader)
          : comfyuiClient.uploadVideo(file, comfyuiHost, authHeader);
      const r = await upload;
      if (!r.ok) throw new Error(r.error.message);

      updateParams({ imageName: r.data.name, scale });
      setMode(target.kind === 'image' ? 'img_upscale' : 'vid_upscale');
      lastUpscaleSourceUrl = target.url;
      toast({ title: '已帶入來源', description: `正在放大 ${target.kind === 'image' ? '圖片' : '影片'}` });
      onClose();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '準備來源失敗',
        description: e instanceof Error ? e.message : '請確認 ComfyUI 已連接',
      });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upscale-dialog-title"
        aria-describedby="upscale-dialog-desc"
        className="relative grid w-full max-w-lg gap-4 rounded-lg border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col space-y-1.5">
          <h2 id="upscale-dialog-title" className="text-lg font-semibold leading-none tracking-tight">
            放大媒體
          </h2>
          <p id="upscale-dialog-desc" className="text-sm text-muted-foreground">
            {target.filename} — {target.kind === 'image' ? 'RealESRGAN' : 'SeedVR2'}
          </p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={cn(
                  'rounded-md border px-3 py-4 text-sm',
                  scale === s && 'border-primary bg-primary/5 ring-2 ring-primary'
                )}
              >
                {s}x
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={preparing}>
              {preparing ? '準備中…' : '開始放大'}
            </Button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          title="關閉"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  );
}
