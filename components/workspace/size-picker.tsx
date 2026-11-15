'use client';

import { ArrowLeftRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generation-store';

type Ratio = { label: string; w: number; h: number } | { label: string; w?: number; h?: number };

const RATIOS: Ratio[] = [
  { label: '1:1', w: 1024, h: 1024 },
  { label: '2:3', w: 682, h: 1024 },
  { label: '3:4', w: 768, h: 1024 },
  { label: '16:9', w: 1024, h: 576 },
  { label: '自訂' },
];

const SIZES = [
  { label: '1K', long: 1024 },
  { label: '2K', long: 2048 },
  { label: '3K', long: 3072 },
  { label: '4K', long: 4096 },
];

/**
 * 文生圖與圖片編輯共用的尺寸選擇器：比例 + 1K/2K/3K/4K + 自訂寬高。
 *
 * @param snap 尺寸對齊步長：一般模型 32；MOSS-Image 畫布需 16 的倍數，傳 16。
 */
export function SizePicker({ snap = 32, hint }: { snap?: 16 | 32; hint?: string }) {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);

  const snapTo = (n: number) =>
    Math.min(4096, Math.max(snap * 2, Math.round(n / snap) * snap));

  const dimValid =
    Number.isFinite(params.width) &&
    Number.isFinite(params.height) &&
    params.width >= 64 &&
    params.width <= 4096 &&
    params.height >= 64 &&
    params.height <= 4096 &&
    params.width % snap === 0 &&
    params.height % snap === 0;

  const applyRatio = (w: number, h: number, long: number = Math.max(params.width, params.height)) => {
    if (w >= h) {
      updateParams({ width: snapTo(long), height: snapTo(long * (h / w)) });
    } else {
      updateParams({ height: snapTo(long), width: snapTo(long * (w / h)) });
    }
  };

  const activeSize = SIZES.find((s) => s.long === Math.max(params.width, params.height));
  const activeRatio = RATIOS.find((r) => r.w && r.h && Math.abs(params.width / params.height - r.w / r.h) < 0.01);

  return (
    <div className="space-y-2">
      <Label>尺寸</Label>
      <div className="grid grid-cols-5 gap-1">
        {RATIOS.map((r) => (
          <button
            key={r.label}
            onClick={() => {
              if (r.w && r.h) applyRatio(r.w, r.h);
            }}
            className={cn(
              'rounded-md border px-2 py-1.5 text-xs transition-colors',
              r.w && activeRatio?.label === r.label && 'bg-primary text-primary-foreground',
              !r.w && (activeRatio ? 'text-muted-foreground border-dashed' : 'bg-primary text-primary-foreground')
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {SIZES.map((s) => (
          <button
            key={s.label}
            onClick={() => applyRatio(params.width, params.height, s.long)}
            className={cn(
              'rounded-md border px-2 py-1.5 text-xs transition-colors',
              activeSize?.label === s.label && 'bg-primary text-primary-foreground'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={params.width}
          onChange={(e) => updateParams({ width: snapTo(Number(e.target.value) || params.width) })}
          className="w-full"
          title={`寬度（需為 ${snap} 的倍數）`}
        />
        <button
          onClick={() => updateParams({ width: params.height, height: params.width })}
          className="shrink-0 rounded-md border p-2 text-muted-foreground hover:text-foreground"
          title="交換長寬"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <Input
          type="number"
          value={params.height}
          onChange={(e) => updateParams({ height: snapTo(Number(e.target.value) || params.height) })}
          className="w-full"
          title={`高度（需為 ${snap} 的倍數）`}
        />
      </div>
      {!dimValid && <p className="text-xs text-destructive">尺寸需為 {snap} 的倍數（64–4096）</p>}
      {dimValid && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
