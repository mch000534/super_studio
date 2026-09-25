import type { Mode } from '@/types/workflow';

export interface ModeMeta {
  id: Mode;
  label: string;
  description: string;
}

export const MODES: ModeMeta[] = [
  { id: 'text2img', label: '文生圖', description: '以文字提示詞生成圖片（z-image / Qwen-Image-2.1）' },
  { id: 'img2img', label: 'z-image_i2i', description: '以圖片為參考生成新圖片' },
  { id: 'text2vid', label: '文生影片', description: '以文字提示詞生成影片' },
  { id: 'img2vid', label: '圖生影片', description: '以首幀圖片生成影片' },
  { id: 'img_upscale', label: '圖片放大', description: '放大圖片解析度' },
  { id: 'vid_upscale', label: '影片放大', description: '放大影片解析度與畫質' },
  { id: 'custom', label: '自定義', description: '上傳並執行自定義工作流' },
];

export function getModeMeta(id: Mode): ModeMeta {
  return MODES.find((m) => m.id === id) || MODES[0];
}
