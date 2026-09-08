'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
import { useGenerationStore } from '@/stores/generation-store';
import { comfyuiClient } from '@/lib/comfyui-client';
import { toast } from '@/hooks/use-toast';
import type { MediaItem } from '@/types/workflow';

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
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>放大媒體</DialogTitle>
          <DialogDescription>
            {target.filename} — {target.kind === 'image' ? 'RealESRGAN' : 'SeedVR2'}
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}