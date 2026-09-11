import type { ErrorResult } from '@/types/comfyui';

export interface ChatTextPart {
  type: 'text';
  text: string;
}

export interface ChatImagePart {
  type: 'image_url';
  image_url: { url: string };
}

export type ChatContentPart = ChatTextPart | ChatImagePart;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
}

export interface LLMConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  max_tokens?: number;
}

type LLMApiResult<T> = { ok: true; data: T } | { ok: false; error: ErrorResult };

export interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface ModelsResponse {
  data?: Array<{ id?: string; name?: string }>;
}

interface LazyCommit {
  method: string;
  path: string;
  body?: string;
}

async function request<T>(
  cfg: LLMConfig,
  req: LazyCommit
): Promise<LLMApiResult<T>> {
  const headers = new Headers();
  headers.set('X-LLM-BaseURL', cfg.baseUrl);
  headers.set('X-LLM-Model', cfg.model);
  if (cfg.apiKey) headers.set('X-LLM-ApiKey', cfg.apiKey);

  let res: Response;
  try {
    res = await fetch(`/api/llm/${req.path}`, {
      method: req.method,
      headers,
      body: req.body,
    });
  } catch {
    return { ok: false, error: { code: 'network', message: '網路錯誤，無法連接到代理伺服器' } };
  }

  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    const errData = (data as { error?: ErrorResult }) || {};
    return {
      ok: false,
      error:
        errData.error ||
        { code: `http_${res.status}`, message: `請求失敗 (${res.status}): ${res.statusText}` },
    };
  }

  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: { code: 'parse', message: '無法解析回應' } };
  }
}

export const llmClient = {
  async chat(
    cfg: LLMConfig,
    messages: ChatMessage[],
    opts?: ChatCompletionOptions
  ): Promise<LLMApiResult<ChatCompletionResponse>> {
    return request<ChatCompletionResponse>(cfg, {
      method: 'POST',
      path: 'chat/completions',
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: opts?.temperature ?? 0.7,
        ...(opts?.max_tokens ? { max_tokens: opts.max_tokens } : {}),
      }),
    });
  },

  async test(cfg: LLMConfig): Promise<LLMApiResult<ModelsResponse>> {
    return request<ModelsResponse>(cfg, { method: 'GET', path: 'models' });
  },
};