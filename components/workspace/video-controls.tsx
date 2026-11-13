'use client';

import { Dices } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGenerationStore } from '@/stores/generation-store';

const RESOLUTIONS = [
  { label: '720p', w: 1280, h: 720 },
  { label: '1080p', w: 1920, h: 1080 },
  { label: '自訂' },
];

export function VideoControls({ showTurbo = true }: { showTurbo?: boolean }) {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const isFastH3 = params.videoModelId === 'fastvideo-fasth3';

  const onModelChange = (v: string) => {
    // 切換模型時清空自訂檔名，讓新模型的預設值生效
    const reset = {
      unetName: undefined,
      clipName: undefined,
      vaeName: undefined,
      audioVaeName: undefined,
      loraName: undefined,
    };
    if (v === 'fasth3') {
      updateParams({ ...reset, videoModelId: 'fastvideo-fasth3', turboMode: false });
    } else {
      updateParams({ ...reset, videoModelId: 'minimax-h3', turboMode: v === 'turbo' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>解析度</Label>
        <div className="grid grid-cols-3 gap-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.label}
              onClick={() => {
                if (r.w) updateParams({ width: r.w, height: r.h });
              }}
              className="rounded-md border px-2 py-1.5 text-xs"
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={params.width}
            onChange={(e) => updateParams({ width: Number(e.target.value) })}
          />
          <span className="text-muted-foreground">×</span>
          <Input
            type="number"
            value={params.height}
            onChange={(e) => updateParams({ height: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>時長（秒）</Label>
          <span className="font-mono text-xs text-muted-foreground">{params.duration ?? 5}</span>
        </div>
        <Slider
          min={2}
          max={30}
          step={1}
          value={[params.duration || 5]}
          onValueChange={([v]) => updateParams({ duration: v })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>FPS</Label>
          <span className="font-mono text-xs text-muted-foreground">{params.fps ?? 24}</span>
        </div>
        <Slider
          min={8}
          max={30}
          step={1}
          value={[params.fps || 24]}
          onValueChange={([v]) => updateParams({ fps: v })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>影片模型</Label>
        <Select
          value={isFastH3 ? 'fasth3' : params.turboMode ? 'turbo' : 'standard'}
          onValueChange={onModelChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">MiniMax H3（標準）</SelectItem>
            <SelectItem value="turbo">MiniMax H3（Turbo）</SelectItem>
            <SelectItem value="fasth3">FastVideo FastH3（8 步）</SelectItem>
          </SelectContent>
        </Select>
        {isFastH3 && (
          <p className="text-xs text-muted-foreground">
            FastH3 為 8 步蒸餾模型，使用 VSA 稀疏注意力；需 ComfyUI 支援相關節點。
          </p>
        )}
      </div>

      {showTurbo && !isFastH3 && (
        <div className="flex items-center justify-between">
          <Label>TURBO</Label>
          <Switch
            checked={!!params.turboMode}
            onCheckedChange={(v) => updateParams({ turboMode: v })}
          />
        </div>
      )}

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
      </div>
    </div>
  );
}