export type Mode =
  | 'text2img'
  | 'img2img'
  | 'img_edit'
  | 'text2vid'
  | 'img2vid'
  | 'img_upscale'
  | 'vid_upscale'
  | 'text2music'
  | 'img23d'
  | 'custom';

export type MediaKind = 'image' | 'video' | 'audio' | '3d';

export interface MediaItem {
  filename: string;
  subfolder: string;
  type: string;
  kind: MediaKind;
  url: string;
  timestamp: number;
  originalWidth?: number;
  originalHeight?: number;
  fileSize?: number;
  isUpscaled?: boolean;
}

export interface GenerationParams {
  prompt: string;
  negativePrompt?: string;
  mode: Mode;

  // common
  seed: number;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  batch: number;

  // img2img
  denoise?: number;
  imageName?: string;

  // qwen-image-2.1 image edit
  refImages?: string[];
  resolution?: number;

  // video
  duration?: number;
  fps?: number;
  turboMode?: boolean;
  loraName?: string;
  firstFrameName?: string;
  lastFrameName?: string;

  // music (text2music)
  lyrics?: string;

  // upscale
  scale?: number;
  upscaleModel?: string;

  // model
  unetName?: string;
  clipName?: string;
  vaeName?: string;
  audioVaeName?: string;

  // custom workflow support
  customWorkflow?: Record<string, unknown>;

  // image model family (text2img)
  imageModelId?: string;
}

export type GenerationStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'success'
  | 'error'
  | 'interrupted';

export interface HistoryRecord {
  id: string;
  timestamp: string;
  mode: Mode;
  prompt: string;
  params: GenerationParams;
  thumbnail: string;
  media: MediaItem[];
}
