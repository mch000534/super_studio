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
  uploadInputImage,
  waitForImages,
} from '@/lib/openai-compat';
import { buildImg2Img, buildQwenImage21Edit } from '@/lib/workflow-templates';
import type { GenerationParams } from '@/types/workflow';

export function OPTIONS() {
  return preflightResponse();
}

/**
 * POST /api/openai/v1/images/edits — OpenAI 圖片編輯相容端點（multipart form）。
 *
 * form: image[]（必填，可多張）、prompt（必填）、model?、n?、size?、
 *       response_format?、denoise?、seed?、steps?、cfg?、negative_prompt?
 *
 * 模型對應：
 * - qwen-image-2.1：多參考圖指令編輯（image1 為編輯目標，prompt 可用
 *   <image1>、<image2>… 引用）
 * - z-image（預設）：單圖 img2img，以 denoise 控制改動幅度
 */
export async function POST(req: NextRequest) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new OpenAICompatError('請求內容必須是 multipart/form-data');
    }

    const prompt = String(form.get('prompt') ?? '').trim();
    if (!prompt) {
      throw new OpenAICompatError('prompt 欄位為必填');
    }

    const imageEntries = form
      .getAll('image')
      .filter((v): v is File => typeof v === 'object' && v !== null && 'arrayBuffer' in v)
      .filter((f) => f.size > 0);
    if (imageEntries.length === 0) {
      throw new OpenAICompatError('至少需上傳一張圖片（欄位名 image）');
    }
    if (imageEntries.length > 10) {
      throw new OpenAICompatError('最多支援 10 張參考圖片');
    }

    const formString = (key: string): string | undefined => {
      const v = form.get(key);
      return typeof v === 'string' ? v : undefined;
    };

    const model = resolveModel(formString('model'));
    const batch = parseBatch(form.get('n'));
    const { width, height } = parseSize(formString('size'));
    const responseFormat = parseResponseFormat(form.get('response_format'));
    const defaults = recommendedParams(model);

    const denoise = optionalNumber(form.get('denoise'), 'denoise');
    if (denoise !== undefined && (denoise < 0 || denoise > 1)) {
      throw new OpenAICompatError('denoise 必須介於 0 與 1 之間');
    }

    const target = resolveComfyTarget(req);

    const refImages: string[] = [];
    for (const file of imageEntries) {
      refImages.push(await uploadInputImage(target, file));
    }

    const baseParams: GenerationParams = {
      prompt,
      negativePrompt: String(form.get('negative_prompt') ?? ''),
      mode: 'img_edit',
      seed: optionalNumber(form.get('seed'), 'seed') ?? -1,
      width,
      height,
      steps: optionalNumber(form.get('steps'), 'steps') ?? defaults.steps,
      cfg: optionalNumber(form.get('cfg'), 'cfg') ?? defaults.cfg,
      batch,
      imageModelId: model,
    };

    let workflow;
    if (model === 'qwen-image-2.1') {
      workflow = buildQwenImage21Edit({
        ...baseParams,
        mode: 'img_edit',
        refImages,
        resolution: width,
      });
    } else {
      workflow = buildImg2Img({
        ...baseParams,
        mode: 'img2img',
        imageName: refImages[0],
        denoise: denoise ?? 0.6,
      });
    }

    const promptId = await queueWorkflow(target, workflow);
    const files = await waitForImages(target, promptId);
    const data = await buildImageData(target, req.nextUrl.origin, files, responseFormat);

    return openaiJson({ created: Math.floor(Date.now() / 1000), data });
  } catch (err) {
    return openaiErrorResponse(err);
  }
}
