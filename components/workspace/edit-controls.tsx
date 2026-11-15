'use client';

import { Dices } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGenerationStore } from '@/stores/generation-store';
import { getImageModelFamily } from '@/lib/image-models';
import { SizePicker } from '@/components/workspace/size-picker';

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

export function EditControls() {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const family = getImageModelFamily(params.imageModelId);
  const isMoss = family.kind === 'moss-image';

  return (
    <div className="space-y-4">
      {/* 輸出尺寸與文生圖同一套選擇器；MOSS 畫布需 16 的倍數，其他模型 32 */}
      <SizePicker
        snap={isMoss ? 16 : 32}
        hint={
          isMoss
            ? '輸出畫布 = 此尺寸（參考圖會自動縮放配對像素量；比例可與參考圖不同，模型會重新構圖）'
            : '輸出畫布 = 此尺寸（比例可與參考圖不同，模型會重新構圖）'
        }
      />

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
        <p className="text-xs text-muted-foreground">
          {isMoss
            ? 'MOSS Edit LoRA 官方建議維持 4：太低會冒出原圖沒有的飾品（項鍊、耳環）'
            : '官方建議保持 1；僅在搭配負向提示詞時提高'}
        </p>
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
