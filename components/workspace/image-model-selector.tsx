'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { IMAGE_MODEL_FAMILIES, getImageModelFamily } from '@/lib/image-models';
import { useGenerationStore } from '@/stores/generation-store';

export function ImageModelSelector() {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);

  const family = getImageModelFamily(params.imageModelId);
  const value = params.imageModelId || IMAGE_MODEL_FAMILIES[0].id;

  return (
    <div className="space-y-1.5">
      <Label>影像模型</Label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (value === v) return;
          const family = getImageModelFamily(v);
          updateParams({
            imageModelId: v,
            steps: family.recommended.steps,
            cfg: family.recommended.cfg,
          });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="選擇影像模型" />
        </SelectTrigger>
        <SelectContent>
          {IMAGE_MODEL_FAMILIES.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{family.description}</p>
    </div>
  );
}