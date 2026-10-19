import {
  OPENAI_IMAGE_MODELS,
  openaiJson,
  openaiErrorResponse,
  preflightResponse,
  recommendedParams,
} from '@/lib/openai-compat';
import { getImageModelFamily } from '@/lib/image-models';

export function OPTIONS() {
  return preflightResponse();
}

/** GET /api/openai/v1/models — 回報可用的生圖模型（OpenAI 格式）。 */
export async function GET() {
  try {
    const data = OPENAI_IMAGE_MODELS.map((id) => {
      const family = getImageModelFamily(id);
      return {
        id,
        object: 'model' as const,
        created: 0,
        owned_by: 'super-studio',
        // 擴充欄位：部分工具會忽略，介面工具可善用
        description: family.description,
        recommended: recommendedParams(id),
      };
    });
    return openaiJson({ object: 'list', data });
  } catch (err) {
    return openaiErrorResponse(err);
  }
}
