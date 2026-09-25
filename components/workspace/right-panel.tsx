'use client';

import { useCallback, useEffect } from 'react';

import { PromptPanel } from '@/components/workspace/prompt-panel';
import { ParameterControls } from '@/components/workspace/parameter-controls';
import { GenerationControls } from '@/components/workspace/generation-controls';
import { ImageModelSelector } from '@/components/workspace/image-model-selector';
import { VideoControls } from '@/components/workspace/video-controls';
import { ImageUpload } from '@/components/workspace/image-upload';
import { UpscaleControls } from '@/components/workspace/upscale-controls';
import { CustomWorkflowPanel } from '@/components/workflow/custom-workflow-panel';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { useGeneration, setResultHandler } from '@/hooks/use-generation';
import { useSettingsStore } from '@/stores/settings-store';
import { useGalleryStore } from '@/stores/gallery-store';
import { useHistoryStore } from '@/stores/history-store';
import { useGenerationStore } from '@/stores/generation-store';
import { comfyuiClient } from '@/lib/comfyui-client';
import { getModeMeta } from '@/lib/modes';
import { toast } from '@/hooks/use-toast';
import type { MediaItem, Mode, GenerationParams } from '@/types/workflow';

async function ensureInputRef(
  item: MediaItem,
  host: string,
  authHeader?: string
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  if (item.type === 'input' && !item.subfolder) {
    return { ok: true, name: item.filename };
  }
  try {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`無法讀取來源圖片（HTTP ${res.status}）`);
    const blob = await res.blob();
    const file = new File([blob], item.filename, { type: blob.type || 'image/png' });
    const r = await comfyuiClient.uploadImage(file, host, authHeader);
    return r.ok ? { ok: true, name: r.data.name } : { ok: false, message: r.error.message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '圖片轉換失敗' };
  }
}

export function RightPanel() {
  const currentMode = useSettingsStore((s) => s.currentMode);
  const addItems = useGalleryStore((s) => s.addItems);
  const addRecord = useHistoryStore((s) => s.addRecord);

  const handleResult = useCallback((media: MediaItem[], mode: Mode, params: GenerationParams) => {
    addItems(media);
    addRecord({
      id: `h_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode,
      prompt: params.prompt,
      params,
      thumbnail: media[0]?.url || '',
      media,
    });
    toast({ title: '生成完成', description: `已新增 ${media.length} 個結果` });
  }, [addItems, addRecord]);

  const { submit, interrupt } = useGeneration();

  useEffect(() => {
    setResultHandler(handleResult);
  }, [handleResult]);

  const onGenerate = () => submit();

  return (
    <div className="w-full border-l p-4 md:w-80 lg:w-96">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{getModeMeta(currentMode).label}</h2>
        <span className="hidden text-xs text-muted-foreground lg:block">
          {getModeMeta(currentMode).description}
        </span>
      </div>
      <PanelContent
        mode={currentMode}
        onGenerate={onGenerate}
        onInterrupt={interrupt}
      />
    </div>
  );
}

function PanelContent({
  mode,
  onGenerate,
  onInterrupt,
}: {
  mode: Mode;
  onGenerate: () => void;
  onInterrupt: () => void;
}) {
  switch (mode) {
    case 'text2img':
      return (
        <div className="space-y-5">
          <PromptPanel />
          <ImageModelSelector />
          <Separator />
          <ParameterControls />
          <Separator />
          <GenerationControls onGenerate={onGenerate} onInterrupt={onInterrupt} />
        </div>
      );
    case 'img2img':
      return <Img2ImgControls onInterrupt={onInterrupt} />;
    case 'text2vid':
      return (
        <div className="space-y-5">
          <PromptPanel placeholder="描述動作、鏡頭、氛圍…" />
          <VideoControls showTurbo={false} />
          <Separator />
          <GenerationControls onGenerate={onGenerate} onInterrupt={onInterrupt} label="生成影片" />
        </div>
      );
    case 'img2vid':
      return <Img2VidControls onInterrupt={onInterrupt} />;
    case 'img_upscale':
      return <ImgUpscaleControls onInterrupt={onInterrupt} />;
    case 'vid_upscale':
      return <VidUpscaleControls onInterrupt={onInterrupt} />;
    case 'custom':
      return <CustomWorkflowPanel />;
    default:
      return null;
  }
}

function Img2ImgControls({ onInterrupt }: { onInterrupt: () => void }) {
  const { comfyuiHost, authHeader } = useSettingsStore();
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const { submit } = useGeneration();

  const handleUpload = async (file: File) => {
    const r = await comfyuiClient.uploadImage(file, comfyuiHost, authHeader);
    if (r.ok) {
      updateParams({ imageName: r.data.name });
      return r.data.name;
    }
    throw new Error(r.error.message);
  };

  const handleSourceSelect = async (item: MediaItem) => {
    if (item.kind !== 'image') return;
    const r = await ensureInputRef(item, comfyuiHost, authHeader);
    if (r.ok) {
      updateParams({ imageName: r.name });
      if (item.type !== 'input' || item.subfolder) {
        toast({ title: '已轉為參考影像', description: '來源圖片已上傳至 ComfyUI input' });
      }
      return;
    }
    toast({ variant: 'destructive', title: '選取失敗', description: r.message });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">可從上方畫廊拖曳圖片至此作為參考</span>
        <ImageUpload
          label="參考影像"
          value={params.imageName ?? null}
          onChange={(data) => {
            if (!data) updateParams({ imageName: undefined });
          }}
          onUpload={handleUpload}
          onGalleryDrop={handleSourceSelect}
        />
      </div>
      <PromptPanel />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Denoise</span>
          <span className="font-mono text-xs text-muted-foreground">{params.denoise ?? 0.6}</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[params.denoise ?? 0.6]}
          onValueChange={([v]) => updateParams({ denoise: v })}
        />
      </div>
      <ParameterControls />
      <Separator />
      <GenerationControls
        onGenerate={() => submit()}
        onInterrupt={onInterrupt}
        disabled={!params.imageName}
      />
      {!params.imageName && (
        <p className="text-xs text-muted-foreground">請先上傳或從畫廊拖曳參考影像再生成</p>
      )}
    </div>
  );
}

function Img2VidControls({ onInterrupt }: { onInterrupt: () => void }) {
  const { comfyuiHost, authHeader } = useSettingsStore();
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const { submit } = useGeneration();

  const upload = async (file: File, key: 'firstFrameName' | 'lastFrameName') => {
    const r = await comfyuiClient.uploadImage(file, comfyuiHost, authHeader);
    if (r.ok) {
      updateParams({ [key]: r.data.name });
      return r.data.name;
    }
    throw new Error(r.error.message);
  };

  const handleGalleryDrop = async (item: MediaItem, key: 'firstFrameName' | 'lastFrameName') => {
    if (item.kind !== 'image') return;
    const r = await ensureInputRef(item, comfyuiHost, authHeader);
    if (r.ok) {
      updateParams({ [key]: r.name });
      if (item.type !== 'input' || item.subfolder) {
        toast({ title: '已轉為參考影像', description: '來源圖片已上傳至 ComfyUI input' });
      }
      return;
    }
    toast({ variant: 'destructive', title: '選取失敗', description: r.message });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <ImageUpload
          label="首幀影像"
          value={params.firstFrameName ?? null}
          onChange={(data) => {
            if (!data) updateParams({ firstFrameName: undefined });
          }}
          onUpload={(f) => upload(f, 'firstFrameName')}
          onGalleryDrop={(item) => handleGalleryDrop(item, 'firstFrameName')}
        />
        <ImageUpload
          label="尾幀（可選）"
          value={params.lastFrameName ?? null}
          onChange={(data) => {
            if (!data) updateParams({ lastFrameName: undefined });
          }}
          onUpload={(f) => upload(f, 'lastFrameName')}
          onGalleryDrop={(item) => handleGalleryDrop(item, 'lastFrameName')}
        />
      </div>
      <PromptPanel placeholder="描述動態效果…" />
      <VideoControls />
      <Separator />
      <GenerationControls onGenerate={() => submit()} onInterrupt={onInterrupt} label="生成影片" />
    </div>
  );
}

function ImgUpscaleControls({ onInterrupt }: { onInterrupt: () => void }) {
  const { comfyuiHost, authHeader } = useSettingsStore();
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const { submit } = useGeneration();

  const handleUpload = async (file: File) => {
    const r = await comfyuiClient.uploadImage(file, comfyuiHost, authHeader);
    if (r.ok) {
      updateParams({ imageName: r.data.name });
      return r.data.name;
    }
    throw new Error(r.error.message);
  };

  const handleSourceSelect = async (item: MediaItem) => {
    if (item.kind !== 'image') return;
    const r = await ensureInputRef(item, comfyuiHost, authHeader);
    if (r.ok) {
      updateParams({ imageName: r.name });
      if (item.type !== 'input' || item.subfolder) {
        toast({ title: '已轉為參考影像', description: '來源圖片已上傳至 ComfyUI input' });
      }
      return;
    }
    toast({ variant: 'destructive', title: '選取失敗', description: r.message });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">可從上方畫廊拖曳圖片至此作為來源</span>
        <ImageUpload
          label="或上傳來源圖片"
          value={params.imageName ?? null}
          onChange={(data) => {
            if (!data) updateParams({ imageName: undefined });
          }}
          onUpload={handleUpload}
          onGalleryDrop={handleSourceSelect}
        />
      </div>
      <UpscaleControls />
      <Separator />
      <GenerationControls
        onGenerate={() => submit()}
        onInterrupt={onInterrupt}
        label="放大圖片"
        disabled={!params.imageName}
      />
    </div>
  );
}

function VidUpscaleControls({ onInterrupt }: { onInterrupt: () => void }) {
  const { comfyuiHost, authHeader } = useSettingsStore();
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const { submit } = useGeneration();

  const handleUpload = async (file: File) => {
    const r = await comfyuiClient.uploadVideo(file, comfyuiHost, authHeader);
    if (r.ok) {
      updateParams({ imageName: r.data.name });
      return r.data.name;
    }
    throw new Error(r.error.message);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">可從上方畫廊拖曳影片至此作為來源</span>
        <ImageUpload
          label="或上傳來源影片"
          value={params.imageName ? 'set' : null}
          onChange={(data) => {
            if (!data) updateParams({ imageName: undefined });
          }}
          onUpload={handleUpload}
          onGalleryDrop={(item) => {
            if (item.kind === 'video') updateParams({ imageName: item.filename });
          }}
        />
      </div>
      <UpscaleControls />
      <Separator />
      <GenerationControls
        onGenerate={() => submit()}
        onInterrupt={onInterrupt}
        label="放大影片"
        disabled={!params.imageName}
      />
    </div>
  );
}
