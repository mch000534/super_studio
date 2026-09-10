'use client';

import { useState, useCallback } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { llmClient, type LLMConfig } from '@/lib/llm-client';
import {
  buildDescribeMessages,
  buildOptimizeMessages,
  parseOptimizedPrompt,
} from '@/lib/prompt-optimizer';
import type { OptimizedPrompt } from '@/lib/prompt-optimizer';
import { toast } from '@/hooks/use-toast';

const MAX_IMAGE_EDGE = 1024;

async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
}

interface OptimizeOptions {
  imageUrl?: string;
}

export function usePromptOptimizer() {
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const describeImage = useCallback(
    async (cfg: LLMConfig, imageDataUrl: string): Promise<string | null> => {
      const res = await llmClient.chat(cfg, buildDescribeMessages(imageDataUrl), {
        temperature: 0.3,
      });
      if (!res.ok) {
        setError(res.error.message);
        return null;
      }
      const content = res.data.choices?.[0]?.message?.content;
      return content?.trim() || null;
    },
    []
  );

  const optimize = useCallback(
    async (
      input: string,
      negativeInput?: string,
      opts?: OptimizeOptions
    ): Promise<OptimizedPrompt | null> => {
      if (!input.trim() && !opts?.imageUrl) {
        setError('請先輸入提示詞再優化');
        return null;
      }

      const { llmBaseUrl, llmModel, llmApiKey } = useSettingsStore.getState();
      if (!llmBaseUrl || !llmModel) {
        setError('尚未設定 LLM 位址或模型，請先到「設定」完成配置');
        return null;
      }

      const cfg: LLMConfig = { baseUrl: llmBaseUrl, model: llmModel, apiKey: llmApiKey };
      setOptimizing(true);
      setError(null);
      try {
        let imageDescription: string | null = null;
        if (opts?.imageUrl) {
          const dataUrl = await imageToDataUrl(opts.imageUrl);
          if (dataUrl) {
            toast({ title: '正在分析圖片', description: '先反推圖片內容…' });
            imageDescription = await describeImage(cfg, dataUrl);
            if (!imageDescription) {
              toast({
                variant: 'destructive',
                title: '無法分析圖片',
                description: '模型可能不支援視覺輸入，將改用純文字提示詞優化',
              });
            }
          } else {
            toast({
              variant: 'destructive',
              title: '無法讀取參考圖片',
              description: '將改用純文字提示詞優化',
            });
          }
        }

        const messages = buildOptimizeMessages(input, negativeInput, imageDescription ?? undefined);
        const res = await llmClient.chat(cfg, messages);

        if (!res.ok) {
          setError(res.error.message);
          return null;
        }

        const content = res.data.choices?.[0]?.message?.content;
        if (!content) {
          setError('LLM 沒有回傳任何內容');
          return null;
        }

        const parsed = parseOptimizedPrompt(content);
        if (!parsed) {
          setError('無法解析 LLM 回傳的提示詞，請檢查模型是否可用');
          return null;
        }

        return parsed;
      } finally {
        setOptimizing(false);
      }
    },
    [describeImage]
  );

  return { optimizing, error, optimize };
}