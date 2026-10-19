import type { NextRequest } from 'next/server';
import {
  OpenAICompatError,
  buildImageData,
  openaiErrorResponse,
  openaiJson,
  optionalNumber,
  parseBatch,
  parseResponseFormat,
  parseSize,
  preflightResponse,
  queueWorkflow,
  recommendedParams,
  resolveComfyTarget,
  resolveModel,
  waitForImages,
} from '@/lib/openai-compat';
import { buildText2Img } from '@/lib/workflow-templates';
import type { GenerationParams } from '@/types/workflow';

export function OPTIONS() {
  return preflightResponse();
}

/**
 * POST /api/openai/v1/images/generations — OpenAI 文生圖相容端點。
 *
 * body: { model?, prompt, n?, size?, response_format?, seed?, steps?, cfg?,
 *         negative_prompt? }
 * 回傳: { created, data: [{ url | b64_json }] }
 */
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      throw new OpenAICompatError('請求內容必須是 JSON');
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      throw new OpenAICompatError('prompt 欄位為必填');
    }

    const model = resolveModel(typeof body.model === 'string' ? body.model : undefined);
    const batch = parseBatch(body.n);
    const { width, height } = parseSize(typeof body.size === 'string' ? body.size : undefined);
    const responseFormat = parseResponseFormat(body.response_format);
    const defaults = recommendedParams(model);

    const params: GenerationParams = {
      prompt,
      negativePrompt: typeof body.negative_prompt === 'string' ? body.negative_prompt : '',
      mode: 'text2img',
      seed: optionalNumber(body.seed, 'seed') ?? -1,
      width,
      height,
      steps: optionalNumber(body.steps, 'steps') ?? defaults.steps,
      cfg: optionalNumber(body.cfg, 'cfg') ?? defaults.cfg,
      batch,
      imageModelId: model,
    };

    const workflow = buildText2Img(params);
    const target = resolveComfyTarget(req);

    const promptId = await queueWorkflow(target, workflow);
    const files = await waitForImages(target, promptId);
    const data = await buildImageData(target, req.nextUrl.origin, files, responseFormat);

    return openaiJson({ created: Math.floor(Date.now() / 1000), data });
  } catch (err) {
    return openaiErrorResponse(err);
  }
}
