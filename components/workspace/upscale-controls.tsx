'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generation-store';

export function UpscaleControls() {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>放大倍數</Label>
        <div className="grid grid-cols-2 gap-1">
          {[2, 4].map((s) => (
            <button
              key={s}
              onClick={() => updateParams({ scale: s })}
              className={cn(
                'rounded-md border px-2 py-1.5 text-sm',
                params.scale === s ? 'bg-primary text-primary-foreground' : ''
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}