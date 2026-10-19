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
        // New API 相容擴充（Cherry Studio 等客戶端讀取此欄位來自動標記
        // 模型為生圖模型，免去使用者手動設定模型類型）
        supported_endpoint_types: ['image-generation', 'image-edit'],
      };
    });
    return openaiJson({ object: 'list', data });
  } catch (err) {
    return openaiErrorResponse(err);
  }
}
