'use client';

import { Dices } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGenerationStore } from '@/stores/generation-store';
import { SizePicker } from '@/components/workspace/size-picker';

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

export function ParameterControls() {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);

  return (
    <div className="space-y-4">
      <SizePicker snap={32} />

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
