export type VideoModelId = 'minimax-h3' | 'fastvideo-fasth3';

export interface VideoModelFamily {
  id: VideoModelId;
  label: string;
  description: string;
  defaults: {
    unetName: string;
    clipName: string;
    vaeName: string;
    audioVaeName: string;
  };
  /** 固定步數；有值時 UI 不提供步數設定（例如 FastH3 為 8 步蒸餾模型）。 */
  fixedSteps?: number;
}

export const VIDEO_MODEL_FAMILIES: VideoModelFamily[] = [
  {
    id: 'minimax-h3',
    label: 'MiniMax H3',
    description: 'MiniMax H3：標準／Turbo 兩種模式，支援文生影片與圖生影片',
    defaults: {
      unetName: 'minimax_h3_fl2va_pruned_int8_convrot.safetensors',
      clipName: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
      vaeName: 'minimax_h3_video_vae_fp16.safetensors',
      audioVaeName: 'minimax_h3_audio_vae_fp32.safetensors',
    },
  },
  {
    id: 'fastvideo-fasth3',
    label: 'FastVideo FastH3（8 步）',
    description: 'FastVideo FastH3：DMD2 蒸餾 8 步，需 ComfyUI 支援稀疏注意力節點',
    defaults: {
      unetName: 'fastvideo_fasth3_8step_v2_pruned_int8_convrot.safetensors',
      clipName: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
      vaeName: 'minimax_h3_video_vae_int8_convrot.safetensors',
      audioVaeName: 'minimax_h3_audio_vae_fp32.safetensors',
    },
    fixedSteps: 8,
  },
];

export function getVideoModelFamily(id?: string): VideoModelFamily {
  return VIDEO_MODEL_FAMILIES.find((f) => f.id === id) || VIDEO_MODEL_FAMILIES[0];
}

export interface VideoResolutionPreset {
  /** 顯示用標籤（目標百萬像素）。 */
  label: string;
  /** 目標百萬像素（MP）。 */
  megapixels: number;
  width: number;
  height: number;
}

/**
 * 16:9 解析度預設，對應 ComfyUI 內建 `ResolutionSelector`（megapixels + 16:9 + multiple=32）。
 * 影片模型（MiniMax H3／FastVideo FastH3）在此解析度級距即可，過大會顯著變慢。
 */
export const VIDEO_RESOLUTION_PRESETS: VideoResolutionPreset[] = [
  { label: '0.2 MP', megapixels: 0.2, width: 608, height: 352 },
  { label: '0.3 MP', megapixels: 0.3, width: 736, height: 416 },
  { label: '0.4 MP', megapixels: 0.4, width: 864, height: 480 },
  { label: '0.5 MP', megapixels: 0.5, width: 960, height: 544 },
  { label: '0.6 MP', megapixels: 0.6, width: 1056, height: 608 },
  { label: '0.7 MP', megapixels: 0.7, width: 1152, height: 640 },
  { label: '0.8 MP', megapixels: 0.8, width: 1216, height: 672 },
  { label: '0.9 MP', megapixels: 0.9, width: 1280, height: 736 },
  { label: '0.98 MP', megapixels: 0.98, width: 1344, height: 768 },
];

/** 影片模式預設解析度（對應 ComfyUI 範本的 0.4 MP 16:9，約 2 分鐘）。 */
export const DEFAULT_VIDEO_RESOLUTION = VIDEO_RESOLUTION_PRESETS[2];

export interface VideoAspectRatio {
  /** 顯示標籤，例如 `16:9`。 */
  label: string;
  /** 比例分子。 */
  w: number;
  /** 比例分母。 */
  h: number;
}

/** 對應 ComfyUI `ResolutionSelector` 支援的 8 種比例。 */
export const VIDEO_ASPECT_RATIOS: VideoAspectRatio[] = [
  { label: '16:9', w: 16, h: 9 },
  { label: '1:1', w: 1, h: 1 },
  { label: '9:16', w: 9, h: 16 },
  { label: '4:3', w: 4, h: 3 },
  { label: '3:4', w: 3, h: 4 },
  { label: '3:2', w: 3, h: 2 },
  { label: '2:3', w: 2, h: 3 },
  { label: '21:9', w: 21, h: 9 },
];

/** 影片寬高對齊單位（對應 ComfyUI `ResolutionSelector` 的 multiple=32）。 */
export const VIDEO_RESOLUTION_MULTIPLE = 32;

function snapToMultiple(value: number): number {
  return Math.max(
    VIDEO_RESOLUTION_MULTIPLE,
    Math.round(value / VIDEO_RESOLUTION_MULTIPLE) * VIDEO_RESOLUTION_MULTIPLE,
  );
}

/**
 * 依比例與百萬像素計算解析度。
 * 16:9 直接採用官方 `ResolutionSelector` 的實測值；其餘比例以相同像素量換算並對齊 32。
 */
export function resolveVideoResolution(
  ratio: VideoAspectRatio,
  megapixels: number,
): { width: number; height: number } {
  if (ratio.w === 16 && ratio.h === 9) {
    const preset = VIDEO_RESOLUTION_PRESETS.find((p) => p.megapixels === megapixels);
    if (preset) return { width: preset.width, height: preset.height };
  }
  const total = megapixels * 1_000_000;
  return {
    width: snapToMultiple(Math.sqrt((total * ratio.w) / ratio.h)),
    height: snapToMultiple(Math.sqrt((total * ratio.h) / ratio.w)),
  };
}

/** 由目前寬高推回最接近的比例。 */
export function findVideoAspectRatio(width: number, height: number): VideoAspectRatio {
  const target = width / height;
  let best = VIDEO_ASPECT_RATIOS[0];
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const ratio of VIDEO_ASPECT_RATIOS) {
    const diff = Math.abs(Math.log(target / (ratio.w / ratio.h)));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ratio;
    }
  }
  return best;
}

/** 由目前寬高推回符合的百萬像素預設；找不到時回傳 undefined（代表自訂解析度）。 */
export function findVideoMegapixels(
  width: number,
  height: number,
  ratio: VideoAspectRatio,
): number | undefined {
  return VIDEO_RESOLUTION_PRESETS.find((p) => {
    const resolved = resolveVideoResolution(ratio, p.megapixels);
    return resolved.width === width && resolved.height === height;
  })?.megapixels;
}

