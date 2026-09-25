'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useGenerationStore } from '@/stores/generation-store';
import { usePromptOptimizer } from '@/hooks/use-llm';
import { useSettingsStore } from '@/stores/settings-store';
import { comfyuiClient } from '@/lib/comfyui-client';
import { toast } from '@/hooks/use-toast';

interface PromptPanelProps {
  showNegative?: boolean;
  placeholder?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export function PromptPanel({ showNegative = true, placeholder, textareaRef }: PromptPanelProps) {
  const params = useGenerationStore((s) => s.params);
  const updateParams = useGenerationStore((s) => s.updateParams);
  const { comfyuiHost, authHeader } = useSettingsStore();
  const { optimizing, describing, describeReference, optimize } = usePromptOptimizer();
  const [showNegativePanel, setShowNegativePanel] = useState(showNegative && !!params.negativePrompt);

  const referenceImageUrl =
    params.mode === 'img2img' && params.imageName
      ? comfyuiClient.getViewUrl(params.imageName, comfyuiHost, '', 'input', { authHeader })
      : undefined;

  const busy = optimizing || describing;

  const handleDescribe = async () => {
    if (!referenceImageUrl) return;
    const description = await describeReference(referenceImageUrl);
    if (!description) {
      toast({ variant: 'destructive', title: '反推失敗', description: '請檢查 LLM 設定與參考圖片' });
      return;
    }
    updateParams({ prompt: description });
    setShowNegativePanel(true);
    toast({ title: '反推完成', description: '已將圖片內容描述填入正向提示詞' });
  };

  const handleOptimize = async () => {
    const result = await optimize(params.prompt, params.negativePrompt);
    if (!result) {
      toast({ variant: 'destructive', title: '優化失敗', description: '請檢查 LLM 設定' });
      setShowNegativePanel(true);
      return;
    }
    updateParams({ prompt: result.positive, negativePrompt: result.negative });
    setShowNegativePanel(true);
    toast({ title: '優化完成', description: '已回填優化後的正向與負向提示詞' });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>提示詞</Label>
          {referenceImageUrl ? (
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handleDescribe}
                disabled={busy}
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
              >
                {describing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                反推圖片
              </Button>
              <Button
                onClick={handleOptimize}
                disabled={busy || !params.prompt.trim()}
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
              >
                {optimizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                優化提示詞
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleOptimize}
              disabled={busy || !params.prompt.trim()}
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
            >
              {optimizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              優化提示詞
            </Button>
          )}
        </div>
        <Textarea
          ref={textareaRef}
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
                placeholder="不希望出現的內容（通常可留空）"
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
