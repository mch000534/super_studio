'use client';

import { Dices } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generation-store';
import { isValidDimension } from '@/lib/utils';

type Ratio = { label: string; w: number; h: number } | { label: string; w?: number; h?: number };

const RATIOS: Ratio[] = [
  { label: '1:1', w: 1024, h: 1024 },
  { label: '3:4', w: 768, h: 1024 },
  { label: '16:9', w: 1024, h: 576 },
  { label: '自訂' },
];

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

export function ParameterControls() {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);

  const dimValid = isValidDimension(params.width) && isValidDimension(params.height);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>尺寸</Label>
        <div className="grid grid-cols-4 gap-1">
          {RATIOS.map((r) => (
            <button
              key={r.label}
              onClick={() => {
                if (r.w && r.h) updateParams({ width: r.w, height: r.h });
              }}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs transition-colors',
                !r.w && 'text-muted-foreground border-dashed'
              )}
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
            className="w-full"
            title="寬度（需為 32 的倍數）"
          />
          <span className="text-muted-foreground">×</span>
          <Input
            type="number"
            value={params.height}
            onChange={(e) => updateParams({ height: Number(e.target.value) })}
            className="w-full"
            title="高度（需為 32 的倍數）"
          />
        </div>
        {!dimValid && (
          <p className="text-xs text-destructive">尺寸需為 32 的倍數（64–4096）</p>
        )}
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
        <p className="text-xs text-muted-foreground">
          {params.seed === -1 || params.batch > 1
            ? '每次生成將自動使用隨機種子'
            : 'seed 為 -1 或批次>1 時自動使用隨機種子'}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>批次數</Label>
        <Input
          type="number"
          min={1}
          max={8}
          value={params.batch}
          onChange={(e) => updateParams({ batch: Math.min(8, Math.max(1, Number(e.target.value))) })}
        />
      </div>
    </div>
  );
}
