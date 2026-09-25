export type ImageModelKind = 'z-image' | 'qwen-image-2.1';

export interface ImageModelFamily {
  id: string;
  kind: ImageModelKind;
  label: string;
  description: string;
  defaults: {
    unetName: string;
    clipName: string;
    vaeName: string;
  };
  recommended: {
    steps: number;
    cfg: number;
  };
}

export const IMAGE_MODEL_FAMILIES: ImageModelFamily[] = [
  {
    id: 'z-image',
    kind: 'z-image',
    label: 'z-image',
    description: 'Z-Image-Turbo：快速出圖，CFG 固定 1，較少步數即可',
    defaults: {
      unetName: 'z_image_turbo_bf16.safetensors',
      clipName: 'qwen_3_4b.safetensors',
      vaeName: 'ae.safetensors',
    },
    recommended: { steps: 8, cfg: 1 },
  },
  {
    id: 'qwen-image-2.1',
    kind: 'qwen-image-2.1',
    label: 'Qwen-Image-2.1',
    description: '原生 2K、支援畫面文字排版與透明背景，品質需要較多步數',
    defaults: {
      unetName: 'qwen_image_2.1_int8_convrot.safetensors',
      clipName: 'qwen3vl_8b_int8_convrot.safetensors',
      vaeName: 'qwen_image_2.1_vae_bf16.safetensors',
    },
    recommended: { steps: 25, cfg: 2 },
  },
];

export function getImageModelFamily(id?: string): ImageModelFamily {
  return IMAGE_MODEL_FAMILIES.find((f) => f.id === id) || IMAGE_MODEL_FAMILIES[0];
}