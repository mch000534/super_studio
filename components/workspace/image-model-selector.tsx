'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  IMAGE_MODEL_FAMILIES,
  getEditImageModelFamilies,
  getImageModelFamily,
} from '@/lib/image-models';
import { useGenerationStore } from '@/stores/generation-store';

interface ImageModelSelectorProps {
  /** text：文生圖模型清單；edit：僅列出支援指令編輯的模型。 */
  variant?: 'text' | 'edit';
  label?: string;
}

export function ImageModelSelector({ variant = 'text', label = '影像模型' }: ImageModelSelectorProps) {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);

  const families = variant === 'edit' ? getEditImageModelFamilies() : IMAGE_MODEL_FAMILIES;
  const family = getImageModelFamily(params.imageModelId);
  // 目前選的模型不在這個清單裡（例如切到編輯模式時仍是 z-image）就先顯示第一項
  const value = families.some((f) => f.id === params.imageModelId) ? params.imageModelId! : families[0].id;
  const shown = families.find((f) => f.id === value) ?? family;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (value === v) return;
          const next = getImageModelFamily(v);
          const preset = variant === 'edit' ? next.editRecommended ?? next.recommended : next.recommended;
          updateParams({
            imageModelId: v,
            steps: preset.steps,
            cfg: preset.cfg,
          });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="選擇影像模型" />
        </SelectTrigger>
        <SelectContent>
          {families.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{shown.description}</p>
    </div>
  );
}
