import type { NextRequest } from 'next/server';
import { DEFAULT_HOST } from '@/stores/settings-store';
import { comfyuiClient } from '@/lib/comfyui-client';
import { getImageModelFamily } from '@/lib/image-models';
import type { FileInfo, HistoryOutput, WorkflowNode } from '@/types/comfyui';

/**
 * OpenAI Images API 相容層（伺服器端共用）。
 *
 * 讓外部工具以 OpenAI 格式（/v1/images/generations、/v1/images/edits、
 * /v1/models）呼叫本專案的 ComfyUI 生圖能力。
 *
 * ComfyUI 位址解析順序：X-ComfyUI-Host header → COMFYUI_HOST 環境變數 →
 * DEFAULT_HOST。認證同理：X-ComfyUI-Auth header → COMFYUI_AUTH 環境變數。
 */

const DEFAULT_TIMEOUT_MS = 600_000;
const POLL_INTERVAL_MS = 1000;

export const OPENAI_IMAGE_MODELS = ['z-image', 'qwen-image-2.1'] as const;
export type OpenAIImageModel = (typeof OPENAI_IMAGE_MODELS)[number];

export class OpenAICompatError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code: string = 'invalid_request_error'
  ) {
    super(message);
    this.name = 'OpenAICompatError';
  }
}

export interface ComfyTarget {
  host: string;
  auth?: string;
}

export function resolveComfyTarget(req: NextRequest): ComfyTarget {
  const host = (
    req.headers.get('X-ComfyUI-Host') ||
    process.env.COMFYUI_HOST ||
    DEFAULT_HOST
  ).replace(/\/+$/, '');
  const auth = req.headers.get('X-ComfyUI-Auth') || process.env.COMFYUI_AUTH || undefined;
  return { host, auth };
}

export function getTimeoutMs(): number {
  const raw = Number(process.env.OPENAI_COMPAT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

// ---------- 回應輔助 ----------

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ComfyUI-Host, X-ComfyUI-Auth',
  };
}

export function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function openaiJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: corsHeaders() });
}

export function openaiErrorResponse(err: unknown): Response {
  if (err instanceof OpenAICompatError) {
    return openaiJson(
      { error: { message: err.message, type: 'invalid_request_error', param: null, code: err.code } },
      err.status
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return openaiJson(
    { error: { message, type: 'server_error', param: null, code: 'internal_error' } },
    500
  );
}

// ---------- 請求參數 ----------

export function resolveModel(model: string | null | undefined): OpenAIImageModel {
  if (!model) return 'z-image';
  if ((OPENAI_IMAGE_MODELS as readonly string[]).includes(model)) {
    return model as OpenAIImageModel;
  }
  throw new OpenAICompatError(
    `未知模型「${model}」，可用模型：${OPENAI_IMAGE_MODELS.join(', ')}`,
    404,
    'model_not_found'
  );
}

export function parseSize(size: string | null | undefined): { width: number; height: number } {
  if (!size || size === 'auto') return { width: 1024, height: 1024 };
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m) {
    throw new OpenAICompatError(`無效的 size「${size}」，格式須為「寬x高」（例如 1024x1024）`);
  }
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (width < 64 || width > 4096 || height < 64 || height > 4096) {
    throw new OpenAICompatError(`size「${size}」超出範圍，寬高須介於 64 與 4096 之間`);
  }
  return { width, height };
}

export function parseBatch(n: unknown): number {
  if (n === undefined || n === null) return 1;
  const value = Number(n);
  if (!Number.isInteger(value) || value < 1 || value > 4) {
    throw new OpenAICompatError('n 必須是 1 到 4 之間的整數');
  }
  return value;
}

export function parseResponseFormat(
  value: unknown,
  fallback: 'url' | 'b64_json' = 'url'
): 'url' | 'b64_json' {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === 'url') return 'url';
  if (value === 'b64_json') return 'b64_json';
  throw new OpenAICompatError('response_format 僅支援 url 或 b64_json');
}

export function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new OpenAICompatError(`${field} 必須是數值`);
  }
  return num;
}

// ---------- ComfyUI 通訊 ----------

async function comfyFetch(target: ComfyTarget, path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (target.auth) headers.set('Authorization', target.auth);
  try {
    return await fetch(`${target.host}/${path}`, { ...init, headers });
  } catch {
    throw new OpenAICompatError(`無法連接 ComfyUI：${target.host}`, 502, 'comfyui_unreachable');
  }
}

function formatNodeErrors(nodeErrors: Record<string, unknown> | undefined): string {
  if (!nodeErrors) return '';
  const details = Object.values(nodeErrors)
    .map((n) => {
      const node = n as { errors?: Array<{ message?: string; details?: string }> };
      return (node.errors || []).map((e) => e.details || e.message).filter(Boolean).join('; ');
    })
    .filter(Boolean)
    .join(' | ');
  return details;
}

export async function queueWorkflow(
  target: ComfyTarget,
  workflow: Record<string, WorkflowNode>
): Promise<string> {
  const res = await comfyFetch(target, 'prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as {
        error?: { message?: string };
        node_errors?: Record<string, unknown>;
      };
      const nodeDetail = formatNodeErrors(data.node_errors);
      if (data.error?.message) detail = data.error.message;
      if (nodeDetail) detail = `${detail}：${nodeDetail}`;
    } catch {
      // 保底 HTTP 狀態
    }
    throw new OpenAICompatError(`ComfyUI 拒絕工作流：${detail}`, 400, 'workflow_rejected');
  }

  const data = (await res.json()) as { prompt_id?: string };
  if (!data.prompt_id) {
    throw new OpenAICompatError('ComfyUI 未回傳 prompt_id', 502, 'comfyui_bad_response');
  }
  return data.prompt_id;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForImages(
  target: ComfyTarget,
  promptId: string,
  timeoutMs: number = getTimeoutMs()
): Promise<FileInfo[]> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await comfyFetch(target, `history/${promptId}`);
    if (res.ok) {
      const body = (await res.json()) as Record<
        string,
        { outputs?: HistoryOutput; status?: { status_str?: string; completed?: boolean; messages?: unknown[] } }
      >;
      const entry = body[promptId];

      if (entry?.status?.status_str === 'error') {
        throw new OpenAICompatError('ComfyUI 執行工作流發生錯誤', 500, 'comfyui_execution_error');
      }

      const images: FileInfo[] = [];
      for (const output of Object.values(entry?.outputs || {})) {
        for (const f of output.images || []) images.push(f);
      }
      if (images.length > 0) return images;

      if (entry?.status?.completed && images.length === 0) {
        throw new OpenAICompatError('工作流已完成但沒有輸出圖片', 500, 'no_output');
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new OpenAICompatError(
    `生成逾時（${Math.round(timeoutMs / 1000)} 秒），可調高 OPENAI_COMPAT_TIMEOUT_MS`,
    504,
    'timeout'
  );
}

export async function uploadInputImage(target: ComfyTarget, file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  form.append('overwrite', 'true');
  const res = await comfyFetch(target, 'upload/image', { method: 'POST', body: form });
  if (!res.ok) {
    throw new OpenAICompatError(`上傳圖片失敗（${file.name}）：HTTP ${res.status}`, 400, 'upload_failed');
  }
  const data = (await res.json()) as { name?: string };
  if (!data.name) {
    throw new OpenAICompatError(`上傳圖片失敗（${file.name}）：未回傳檔名`, 502, 'comfyui_bad_response');
  }
  return data.name;
}

// ---------- 結果轉換 ----------

export interface OpenAIImageData {
  url?: string;
  b64_json?: string;
}

export async function buildImageData(
  target: ComfyTarget,
  origin: string,
  files: FileInfo[],
  responseFormat: 'url' | 'b64_json'
): Promise<OpenAIImageData[]> {
  if (responseFormat === 'b64_json') {
    return Promise.all(
      files.map(async (f) => {
        const params = new URLSearchParams({
          filename: f.filename,
          subfolder: f.subfolder,
          type: f.type,
        });
        const res = await comfyFetch(target, `view?${params.toString()}`);
        if (!res.ok) {
          throw new OpenAICompatError(`讀取圖片失敗（${f.filename}）：HTTP ${res.status}`, 502, 'view_failed');
        }
        const buf = Buffer.from(await res.arrayBuffer());
        return { b64_json: buf.toString('base64') };
      })
    );
  }

  return files.map((f) => ({
    url: `${origin}${comfyuiClient.getViewUrl(f.filename, target.host, f.subfolder, f.type, {
      authHeader: target.auth,
    })}`,
  }));
}

// ---------- 模型預設參數 ----------

export function recommendedParams(model: OpenAIImageModel): { steps: number; cfg: number } {
  const family = getImageModelFamily(model);
  return { steps: family.recommended.steps, cfg: family.recommended.cfg };
}
