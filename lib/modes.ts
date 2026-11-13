import type { Mode } from '@/types/workflow';

export interface ModeMeta {
  id: Mode;
  label: string;
  description: string;
}

export const MODES: ModeMeta[] = [
  { id: 'text2img', label: '文生圖', description: '以文字提示詞生成圖片（z-image / Qwen-Image-2.1）' },
  { id: 'img2img', label: 'z-image_i2i', description: '以圖片為參考生成新圖片' },
  {
    id: 'img_edit',
    label: '圖片編輯',
    description: '上傳最多 10 張參考圖，以文字指令編輯（image1 為編輯目標；支援 <image1>、<image2>… 引用）',
  },
  {
    id: 'text2vid',
    label: '文生影片',
    description: '以文字提示詞生成影片（MiniMax H3／FastVideo FastH3，含音訊）',
  },
  {
    id: 'img2vid',
    label: '圖生影片',
    description: '以首幀（可選尾幀）圖片生成影片（MiniMax H3／FastVideo FastH3，含音訊）',
  },
  { id: 'img_upscale', label: '圖片放大', description: '放大圖片解析度' },
  { id: 'vid_upscale', label: '影片放大', description: '放大影片解析度與畫質' },
  {
    id: 'text2music',
    label: '文生音樂',
    description: '以文字描述曲風與歌詞生成完整歌曲（MiniMax Music 3，輸出 MP3）',
  },
  {
    id: 'img23d',
    label: '圖片轉 3D',
    description: '以圖片生成帶貼圖的 3D 模型（TRELLIS 2，含去背景、重拓樑與 UV 烘焙，輸出 GLB）',
  },
  { id: 'custom', label: '自定義', description: '上傳並執行自定義工作流' },
];

export function getModeMeta(id: Mode): ModeMeta {
  return MODES.find((m) => m.id === id) || MODES[0];
}
