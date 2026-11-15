export type ImageModelKind = 'z-image' | 'qwen-image-2.1' | 'moss-image';

export interface ImageModelFamily {
  id: string;
  kind: ImageModelKind;
  label: string;
  description: string;
  /** CLIPLoader 的 type 參數（各家族的文字編碼器格式不同）。 */
  clipType: string;
  /** 是否支援「圖片編輯」指令編輯（多參考圖）。 */
  supportsEdit?: boolean;
  /** 編輯模式使用的 LoRA（接在 UNET 之後）。 */
  editLoraName?: string;
  /** 編輯模式的建議取樣參數（未提供時沿用 recommended）。 */
  editRecommended?: {
    steps: number;
    cfg: number;
  };
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

export const MOSS_DEFAULT_NEGATIVE = 'nsfw, worst quality, bad anatomy, watermark, jpeg artifact';

export const IMAGE_MODEL_FAMILIES: ImageModelFamily[] = [
  {
    id: 'z-image',
    kind: 'z-image',
    label: 'z-image',
    description: 'Z-Image-Turbo：快速出圖，CFG 固定 1，較少步數即可',
    clipType: 'lumina2',
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
    clipType: 'qwen_image',
    supportsEdit: true,
    defaults: {
      unetName: 'qwen_image_2.1_int8_convrot.safetensors',
      clipName: 'qwen3vl_8b_int8_convrot.safetensors',
      vaeName: 'qwen_image_2.1_vae_bf16.safetensors',
    },
    recommended: { steps: 25, cfg: 2 },
  },
  {
    id: 'moss-image',
    kind: 'moss-image',
    label: 'MOSS-Image',
    description:
      '5B 單流 DiT，中英文字排版準確、支援佈局框；編輯走 Edit LoRA，只改指令描述的部分',
    clipType: 'moss_image',
    supportsEdit: true,
    editLoraName: 'moss_image_edit_lora_rank_64_bf16.safetensors',
    editRecommended: { steps: 30, cfg: 4 },
    defaults: {
      unetName: 'moss_image_sft_int8_convrot.safetensors',
      clipName: 'qwen3.5_9b_w4a8_gptq.safetensors',
      vaeName: 'flux2-vae_small.safetensors',
    },
    // 官方建議 euler / CFG 3 / 50 步；預設折衷為 30 步（模板值 25 步偏快）
    recommended: { steps: 30, cfg: 3 },
  },
];

export function getImageModelFamily(id?: string): ImageModelFamily {
  return IMAGE_MODEL_FAMILIES.find((f) => f.id === id) || IMAGE_MODEL_FAMILIES[0];
}

/** 支援指令編輯的模型（圖片編輯模式的下拉選單來源）。 */
export function getEditImageModelFamilies(): ImageModelFamily[] {
  return IMAGE_MODEL_FAMILIES.filter((f) => f.supportsEdit);
}

/** 預設的可編輯模型（Qwen-Image-2.1）。 */
export function getDefaultEditModelId(): string {
  return getEditImageModelFamilies()[0]?.id ?? 'qwen-image-2.1';
}
