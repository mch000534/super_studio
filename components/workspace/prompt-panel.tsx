'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useGenerationStore } from '@/stores/generation-store';

interface PromptPanelProps {
  showNegative?: boolean;
  placeholder?: string;
}

export function PromptPanel({ showNegative = true, placeholder }: PromptPanelProps) {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const [showNegativePanel, setShowNegativePanel] = useState(showNegative && !!params.negativePrompt);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>提示詞</Label>
        <Textarea
          value={params.prompt}
          onChange={(e) => updateParams({ prompt: e.target.value })}
          placeholder={placeholder || '描述你想要的影像…'}
          rows={4}
          className="resize-none"
        />
      </div>

      {showNegative && (
        <div>
          <button
            onClick={() => setShowNegativePanel((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showNegativePanel ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            負向提示詞
          </button>
          {showNegativePanel && (
            <div className="mt-2 space-y-1.5">
              <Textarea
                value={params.negativePrompt || ''}
                onChange={(e) => updateParams({ negativePrompt: e.target.value })}
                placeholder="不希望出現的內容（Z-Image-Turbo 通常可留空）"
                rows={2}
                className="resize-none text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
