'use client';

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { comfyuiClient } from '@/lib/comfyui-client';
import { useSettingsStore } from '@/stores/settings-store';
import { useGenerationStore } from '@/stores/generation-store';
import type { Mode } from '@/types/workflow';

const MODELS_BY_MODE: Record<string, { label: string; folder: string; key: 'unetName' | 'vaeName' | 'clipName' | 'upscaleModel' }[]> = {
  text2img: [],
  img2img: [],
  text2vid: [],
  img2vid: [],
  img_upscale: [
    { label: '放大模型', folder: 'upscale_models', key: 'upscaleModel' },
  ],
  vid_upscale: [
    { label: '放大模型', folder: 'seedvr2', key: 'upscaleModel' },
  ],
  custom: [],
};

export function ModelSelector({ mode }: { mode: Mode }) {
  const { comfyuiHost, authHeader } = useSettingsStore();
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);

  const [options, setOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!['img_upscale', 'vid_upscale'].includes(mode)) return;
    MODELS_BY_MODE[mode].forEach(({ folder, }) => {
      comfyuiClient.listModels(folder, comfyuiHost, authHeader).then((r) => {
        if (r.ok) {
          setOptions((prev) => ({ ...prev, [folder]: r.data.map((m) => m.name) }));
        }
      });
    });
  }, [mode, comfyuiHost, authHeader]);

  const configs = MODELS_BY_MODE[mode] || [];
  if (configs.length === 0) return null;

  return (
    <div className="space-y-3">
      {configs.map(({ label, folder, key }) => (
        <div key={folder} className="space-y-1.5">
          <Label>{label}</Label>
          <Select
            value={params[key] || ''}
            onValueChange={(v) => updateParams({ [key]: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="選擇模型" />
            </SelectTrigger>
            <SelectContent>
              {(options[folder] || []).map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
