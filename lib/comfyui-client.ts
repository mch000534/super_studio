import type {
  ApiResult,
  ComfyUISystemStats,
  HistoryEntry,
  ModelFolderItem,
  PromptRequest,
  PromptResponse,
  UploadResponse,
  WorkflowNode,
} from '@/types/comfyui';
import type { ErrorResult } from '@/types/comfyui';

function makeError(code: string, message: string, nodeErrors?: Record<string, unknown>): ErrorResult {
  return { code, message, nodeErrors };
}

async function request<T>(
  path: string,
  init: RequestInit & { host?: string; authHeader?: string; isFormData?: boolean } = {}
): Promise<ApiResult<T>> {
  const { host, authHeader, ...rest } = init;
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (host) headers.set('X-ComfyUI-Host', host);
  if (authHeader) headers.set('X-ComfyUI-Auth', authHeader);

  let res: Response;
  try {
    res = await fetch(`/api/comfyui/${path}`, {
      ...rest,
      headers,
    });
  } catch {
    return { ok: false, error: makeError('network', '網路錯誤，無法連接到代理伺服器') };
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
        makeError(`http_${res.status}`, `請求失敗 (${res.status}): ${res.statusText}`),
    };
  }

  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: makeError('parse', '無法解析回應') };
  }
}

export const comfyuiClient = {
  async testConnection(
    host: string,
    authHeader?: string
  ): Promise<ApiResult<ComfyUISystemStats>> {
    return request<ComfyUISystemStats>('system_stats', { host, authHeader });
  },

  async queuePrompt(
    workflow: Record<string, WorkflowNode>,
    clientId: string | undefined,
    host: string,
    authHeader?: string
  ): Promise<ApiResult<PromptResponse>> {
    const payload: PromptRequest = { prompt: workflow };
    if (clientId) payload.client_id = clientId;
    return request<PromptResponse>('prompt', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      host,
      authHeader,
    });
  },

  async interrupt(host: string, authHeader?: string): Promise<ApiResult<unknown>> {
    return request<unknown>('interrupt', { method: 'POST', host, authHeader });
  },

  async getHistory(
    promptId: string,
    host: string,
    authHeader?: string
  ): Promise<ApiResult<HistoryEntry>> {
    return request<HistoryEntry>(`history/${promptId}`, { host, authHeader });
  },

  async uploadImage(
    file: File,
    host: string,
    authHeader?: string
  ): Promise<ApiResult<UploadResponse>> {
    const form = new FormData();
    form.append('image', file);
    form.append('overwrite', 'true');
    const data = await request<UploadResponse>('upload', {
      method: 'POST',
      body: form,
      host,
      authHeader,
      isFormData: true,
    });
    return data;
  },

  async uploadVideo(
    file: File,
    host: string,
    authHeader?: string
  ): Promise<ApiResult<UploadResponse>> {
    const form = new FormData();
    form.append('video', file);
    form.append('overwrite', 'true');
    return request<UploadResponse>('upload-video', {
      method: 'POST',
      body: form,
      host,
      authHeader,
      isFormData: true,
    });
  },

  async listModels(
    folder: string,
    host: string,
    authHeader?: string
  ): Promise<ApiResult<ModelFolderItem[]>> {
    const res = await request<{ [key: string]: unknown }>(`models/${folder}`, {
      host,
      authHeader,
    });
    if (res.ok) {
      const keys = Object.keys(res.data);
      return { ok: true, data: keys.map((name) => ({ name })) };
    }
    return res;
  },

  getViewUrl(
    filename: string,
    host: string,
    subfolder = '',
    type = 'output',
    opts?: { preview?: string; res?: number; authHeader?: string }
  ): string {
    const base = '/api/comfyui/view';
    const params = new URLSearchParams({
      filename,
      subfolder,
      type,
    });
    if (opts?.preview) params.set('preview', opts.preview);
    if (opts?.res) params.set('res', String(opts.res));
    const hostParam = encodeURIComponent(host);
    return `${base}?${params.toString()}&__host=${hostParam}${
      opts?.authHeader ? `&__auth=${encodeURIComponent(opts.authHeader)}` : ''
    }`;
  },
};
