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
