'use client';

import { useCallback, useEffect, useRef } from 'react';

import { PromptPanel } from '@/components/workspace/prompt-panel';
import { ParameterControls } from '@/components/workspace/parameter-controls';
import { GenerationControls } from '@/components/workspace/generation-controls';
import { ImageModelSelector } from '@/components/workspace/image-model-selector';
import { VideoControls } from '@/components/workspace/video-controls';
import { ImageUpload } from '@/components/workspace/image-upload';
import { ReferenceImagesUpload } from '@/components/workspace/reference-images-upload';
import { EditControls } from '@/components/workspace/edit-controls';
import { UpscaleControls } from '@/components/workspace/upscale-controls';
import { CustomWorkflowPanel } from '@/components/workflow/custom-workflow-panel';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dices } from 'lucide-react';
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
    // 放大模式的結果標記 isUpscaled，畫廊卡片會顯示 HD 徽章以便辨識
    const finalMedia =
      mode === 'img_upscale' || mode === 'vid_upscale'
        ? media.map((m) => ({ ...m, isUpscaled: true }))
        : media;
    addItems(finalMedia);
    addRecord({
      id: `h_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode,
      prompt: params.prompt,
      params,
      thumbnail: finalMedia[0]?.url || '',
      media: finalMedia,
    });
    toast({ title: '生成完成', description: `已新增 ${finalMedia.length} 個結果` });
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
    case 'img_edit':
      return <ImgEditControls onInterrupt={onInterrupt} />;
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
    case 'text2music':
      return <Text2MusicControls onInterrupt={onInterrupt} />;
    case 'img23d':
      return <Img23DControls onInterrupt={onInterrupt} />;
    case 'custom':
      return <CustomWorkflowPanel />;
    default:
      return null;
  }
}

function SeedRow() {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);

  return (
    <div className="space-y-1.5">
      <Label>Seed</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={params.seed}
          onChange={(e) => updateParams({ seed: Number(e.target.value) })}
          className="font-mono"
        />
        <button
          onClick={() => updateParams({ seed: Math.floor(Math.random() * 1_000_000_000) })}
          className="rounded-md border p-2 text-muted-foreground hover:text-foreground"
          title="隨機 Seed"
        >
          <Dices className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {params.seed === -1 ? '每次生成將自動使用隨機種子' : 'seed 為 -1 時自動使用隨機種子'}
      </p>
    </div>
  );
}

function Text2MusicControls({ onInterrupt }: { onInterrupt: () => void }) {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const { submit } = useGeneration();

  const duration = Math.min(300, Math.max(5, params.duration ?? 60));

  return (
    <div className="space-y-5">
      <PromptPanel placeholder="描述曲風、樂器、節奏與氛圍（例：lo-fi hip hop, warm piano, 80 BPM）…" />
      <div className="space-y-1.5">
        <Label>歌詞</Label>
        <Textarea
          value={params.lyrics ?? ''}
          onChange={(e) => updateParams({ lyrics: e.target.value })}
          placeholder={'留空＝純音樂（instrumental）\n\nRain against the window\nCity lights softly glow…'}
          rows={6}
        />
        <p className="text-xs text-muted-foreground">
          歌詞以換行分段（每段一首詩句）；留空則生成純音樂。
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">時長（秒）</span>
          <span className="font-mono text-xs text-muted-foreground">{duration}</span>
        </div>
        <Slider
          min={5}
          max={300}
          step={5}
          value={[duration]}
          onValueChange={([v]) => updateParams({ duration: v })}
        />
      </div>
      <SeedRow />
      <Separator />
      <GenerationControls
        onGenerate={() => submit()}
        onInterrupt={onInterrupt}
        label="生成音樂"
        disabled={!params.prompt.trim()}
      />
      {!params.prompt.trim() && (
        <p className="text-xs text-muted-foreground">請先輸入曲風描述再生成</p>
      )}
    </div>
  );
}

function Img23DControls({ onInterrupt }: { onInterrupt: () => void }) {
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
          label="要轉成 3D 的圖片"
          value={params.imageName ?? null}
          onChange={(data) => {
            if (!data) updateParams({ imageName: undefined });
          }}
          onUpload={handleUpload}
          onGalleryDrop={handleSourceSelect}
        />
        <p className="text-xs text-muted-foreground">
          建議使用背景乾淨、主體完整的圖片（會自動去背景並裁切為方形）。
        </p>
      </div>
      <SeedRow />
      <Separator />
      <GenerationControls
        onGenerate={() => submit()}
        onInterrupt={onInterrupt}
        label="生成 3D 模型"
        disabled={!params.imageName}
      />
      {!params.imageName && (
        <p className="text-xs text-muted-foreground">請先上傳或從畫廊拖曳圖片再生成</p>
      )}
      <p className="text-xs text-muted-foreground">
        完整管線：去背景 → TRELLIS 2 結構／形狀／紋理生成 → 重拓樑 → 4K UV
        貼圖烘焙，需數分鐘，完成後輸出帶貼圖的 GLB 檔。
      </p>
    </div>
  );
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

function ImgEditControls({ onInterrupt }: { onInterrupt: () => void }) {
  const { comfyuiHost, authHeader } = useSettingsStore();
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const { submit } = useGeneration();
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const refImages = params.refImages ?? [];

  const insertRefToken = (index: number) => {
    const token = `<image${index + 1}>`;
    const ta = promptTextareaRef.current;
    const current = params.prompt || '';
    if (ta) {
      const start = ta.selectionStart ?? current.length;
      const end = ta.selectionEnd ?? start;
      const next = current.slice(0, start) + token + current.slice(end);
      updateParams({ prompt: next });
      requestAnimationFrame(() => {
        const pos = start + token.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      });
    } else {
      updateParams({ prompt: current ? `${current} ${token}` : token });
    }
  };

  const handleUpload = async (file: File) => {
    const r = await comfyuiClient.uploadImage(file, comfyuiHost, authHeader);
    if (r.ok) return r.data.name;
    throw new Error(r.error.message);
  };

  const handleGalleryPick = async (item: MediaItem) => {
    if (item.kind !== 'image') throw new Error('僅支援圖片作為參考');
    const r = await ensureInputRef(item, comfyuiHost, authHeader);
    if (!r.ok) {
      toast({ variant: 'destructive', title: '選取失敗', description: r.message });
      throw new Error(r.message);
    }
    return r.name;
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <ReferenceImagesUpload
          values={refImages}
          onChange={(v) => updateParams({ refImages: v })}
          onUpload={handleUpload}
          onGalleryPick={handleGalleryPick}
          onTileClick={insertRefToken}
          max={10}
        />
        <p className="text-xs text-muted-foreground">
          可從上方畫廊拖曳圖片至此。第 1 張（image1）為編輯目標，其餘為參考素材；提示詞中用{' '}
          <code className="font-mono text-[10px]">&lt;image1&gt;</code>、{' '}
          <code className="font-mono text-[10px]">&lt;image2&gt;</code>… 引用。
        </p>
      </div>
      <PromptPanel
        placeholder="輸入編輯指令（引用上方參考圖的位置）…"
        textareaRef={promptTextareaRef}
      />
      <Separator />
      <EditControls />
      <Separator />
      <GenerationControls
        onGenerate={() => submit()}
        onInterrupt={onInterrupt}
        label="編輯圖片"
        disabled={refImages.length === 0}
      />
      {refImages.length === 0 && (
        <p className="text-xs text-muted-foreground">請先上傳或拖曳至少 1 張編輯目標圖片</p>
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

  const handleSourceSelect = async (item: MediaItem) => {
    if (item.kind !== 'video') return;
    const r = await ensureInputRef(item, comfyuiHost, authHeader);
    if (r.ok) {
      updateParams({ imageName: r.name });
      if (item.type !== 'input' || item.subfolder) {
        toast({ title: '已轉為參考影片', description: '來源影片已上傳至 ComfyUI input' });
      }
      return;
    }
    toast({ variant: 'destructive', title: '選取失敗', description: r.message });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">可從上方畫廊拖曳影片至此作為來源</span>
        <ImageUpload
          label="或上傳來源影片"
          value={params.imageName ?? null}
          acceptVideo
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
        label="放大影片"
        disabled={!params.imageName}
      />
    </div>
  );
}
