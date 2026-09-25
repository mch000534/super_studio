'use client';

import { Dices } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGenerationStore } from '@/stores/generation-store';

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

export function EditControls() {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>輸出解析度</Label>
          <span className="font-mono text-xs text-muted-foreground">{params.resolution ?? 1024}</span>
        </div>
        <Slider
          min={512}
          max={2048}
          step={32}
          value={[params.resolution ?? 1024]}
          onValueChange={([v]) => updateParams({ resolution: v })}
        />
        <p className="text-xs text-muted-foreground">
          參考圖縮放至約此像素預算（0 時保持原尺寸；輸出將以第一張參考圖的比例產生）
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Steps</Label>
          <span className="font-mono text-xs text-muted-foreground">{params.steps}</span>
        </div>
        <Slider
          min={1}
          max={50}
          step={1}
          value={[params.steps]}
          onValueChange={([v]) => updateParams({ steps: v })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>CFG</Label>
          <span className="font-mono text-xs text-muted-foreground">{params.cfg}</span>
        </div>
        <Slider
          min={1}
          max={10}
          step={0.5}
          value={[params.cfg]}
          onValueChange={([v]) => updateParams({ cfg: v })}
        />
        <p className="text-xs text-muted-foreground">官方建議保持 1；僅在搭配負向提示詞時提高</p>
      </div>

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
            onClick={() => updateParams({ seed: randomSeed() })}
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