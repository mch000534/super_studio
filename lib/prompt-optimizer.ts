import type { ChatMessage } from '@/lib/llm-client';

export interface OptimizedPrompt {
  positive: string;
  negative: string;
}

const SYSTEM_PROMPT = `你是專業的 AI 繪圖提示詞工程師，擅長把口語或中文描述擴充成高品質的英文提示詞。

你只回應一個 JSON 物件，不要輸出任何其他文字、註解或程式碼圍欄。格式如下：
{"positive": "優化後的英文正向提示詞", "negative": "對應的英文負向提示詞"}

規則：
- 正向提示詞要擴充主體、材質、光影、構圖、鏡頭、風格與畫質關鍵字（如 high detail, masterpiece, sharp focus）。
- 若使用者完全沒有轉英文的需求也照樣輸出英文，這是給繪圖模型的格式。
- 若提供 imageDescription（圖片內容描述），請把圖片中的主體與細節融入正向提示詞。
- 負向提示詞列舉不想要的元素，例如低畫質與變形，若無特別輸入也給一組通用的。

使用者輸入的情境會以 JSON 提供，包含 original（原始提示詞）、originalNegative（可選的原始負向提示詞）與 imageDescription（可選的圖片內容描述）。`;

export function buildOptimizeMessages(
  input: string,
  negativeInput?: string,
  imageDescription?: string
): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        original: input,
        originalNegative: negativeInput || '',
        imageDescription: imageDescription || '',
      }),
    },
  ];
}

export const DESCRIBE_SYSTEM_PROMPT = `你是圖片內容分析師。觀察使用者提供的圖片，用英文寫一段**簡潔**的描述（約 50-100 字，一句或兩句），重點是：主要主體與其動作、構圖（遠景/特寫/角度）、光線與色調、材質與氛圍、明確的風格特徵。這些文字要能直接當提示詞使用。不要引言、前言、標記或翻譯，只輸出描述本身。`;

export function buildDescribeMessages(imageDataUrl: string): ChatMessage[] {
  return [
    { role: 'system', content: DESCRIBE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: '請描述這張圖片的內容：' },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];
}

export function parseOptimizedPrompt(raw: string): OptimizedPrompt | null {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const positive = typeof obj.positive === 'string' ? obj.positive.trim() : '';
    const negative = typeof obj.negative === 'string' ? obj.negative.trim() : '';
    if (!positive) return null;
    return { positive, negative };
  } catch {
    return null;
  }
}