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

const MAX_IMAGE_EDGE = 768;

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

export function usePromptOptimizer() {
  const [optimizing, setOptimizing] = useState(false);
  const [describing, setDescribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const describeImage = useCallback(
    async (cfg: LLMConfig, imageDataUrl: string): Promise<string | null> => {
      const res = await llmClient.chat(cfg, buildDescribeMessages(imageDataUrl), {
        temperature: 0.3,
        max_tokens: 1500,
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

  const describeReference = useCallback(
    async (imageUrl: string): Promise<string | null> => {
      const { llmBaseUrl, llmModel, llmApiKey } = useSettingsStore.getState();
      if (!llmBaseUrl || !llmModel) {
        setError('尚未設定 LLM 位址或模型，請先到「設定」完成配置');
        return null;
      }
      const cfg: LLMConfig = { baseUrl: llmBaseUrl, model: llmModel, apiKey: llmApiKey };
      setDescribing(true);
      setError(null);
      try {
        const dataUrl = await imageToDataUrl(imageUrl);
        if (!dataUrl) {
          setError('無法讀取參考圖片');
          return null;
        }
        toast({ title: '正在分析圖片', description: '反推圖片內容…' });
        const description = await describeImage(cfg, dataUrl);
        if (!description) {
          setError('無法分析圖片，模型可能不支援視覺輸入');
          return null;
        }
        return description;
      } finally {
        setDescribing(false);
      }
    },
    [describeImage]
  );

  const optimize = useCallback(
    async (input: string, negativeInput?: string): Promise<OptimizedPrompt | null> => {
      if (!input.trim()) {
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
        const messages = buildOptimizeMessages(input, negativeInput);
        const res = await llmClient.chat(cfg, messages, { max_tokens: 2000 });

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
    []
  );

  return { optimizing, describing, error, describeReference, optimize };
}