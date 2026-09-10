import type { GenerationParams, Mode } from '@/types/workflow';
import type { WorkflowNode } from '@/types/comfyui';

export interface WorkflowTemplate {
  name: string;
  mode: Mode;
  build: (params: GenerationParams) => Record<string, WorkflowNode>;
}

const PREFIX = 'SuperStudio';

export function frameCountForDuration(seconds: number): number {
  const desired = Math.max(5, Math.round(seconds * 24));
  const k = Math.max(0, Math.ceil((desired - 5) / 17));
  return 17 * k + 5;
}

function baseVideoNodes(params: GenerationParams): Record<string, WorkflowNode> {
  const { unetName, clipName, vaeName, audioVaeName } = params;
  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name:
          unetName || 'minimax_h3_fl2va_pruned_int8_convrot.safetensors',
        weight_dtype: 'default',
      },
    },
    '2': {
      class_type: 'CLIPLoader',
      inputs: {
        clip_name: clipName || 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
        type: 'minimax',
      },
    },
    '3': {
      class_type: 'VAELoader',
      inputs: { vae_name: vaeName || 'minimax_h3_video_vae_fp16.safetensors' },
    },
    '4': {
      class_type: 'VAELoader',
      inputs: { vae_name: audioVaeName || 'minimax_h3_audio_vae_fp32.safetensors' },
    },
  };
}

function audioToVideoNodes(
  modelRef: unknown,
  framesNodeId: string,
  params: GenerationParams
): Record<string, WorkflowNode> {
  const fps = params.fps ?? 24;
  return {
    'vae_decode': {
      class_type: 'VAEDecode',
      inputs: { samples: ['ks_turbo', 0], vae: ['3', 0] },
    },
    'vae_decode_audio': {
      class_type: 'VAEDecodeAudio',
      inputs: { samples: ['ks_turbo', 0], vae: ['4', 0] },
    },
    'create_video': {
      class_type: 'CreateVideo',
      inputs: { images: ['vae_decode', 0], fps, audio: ['vae_decode_audio', 0] },
    },
    'save_video': {
      class_type: 'SaveVideo',
      inputs: {
        video: ['create_video', 0],
        filename_prefix: `${PREFIX}-video`,
        format: 'auto',
      },
    },
  };
}

function buildVideoWorkflow(params: GenerationParams, withFrames: boolean): Record<string, WorkflowNode> {
  const frames = frameCountForDuration(params.duration ?? 5);
  const turbo = params.turboMode ?? false;
  const steps = turbo ? 8 : 20;
  const nodes = baseVideoNodes(params);

  const modelRef = turbo ? ['lora_turbo', 0] : ['1', 0];
  if (turbo) {
    nodes['lora_turbo'] = {
      class_type: 'LoraLoader',
      inputs: {
        model: ['1', 0],
        lora_name:
          params.loraName || 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors',
        strength_model: 1,
        strength_clip: 1,
      },
    } as WorkflowNode;
  }

  const h3Inputs: Record<string, unknown> = {
    clip: ['2', 0],
    vae: ['3', 0],
    prompt: params.prompt,
    width: params.width,
    height: params.height,
    length: frames,
  };
  if (withFrames) {
    if (params.firstFrameName) h3Inputs['first_frame'] = ['load_first', 0];
    if (params.lastFrameName) h3Inputs['last_frame'] = ['load_last', 0];
  }

  const h3NodeId = 'h3';
  nodes[h3NodeId] = {
    class_type: 'MiniMaxH3ImageToVideo',
    inputs: h3Inputs,
  } as WorkflowNode;

  nodes['zero_out'] = {
    class_type: 'ConditioningZeroOut',
    inputs: { conditioning: [h3NodeId, 0] },
  } as WorkflowNode;

  nodes['ks_turbo'] = {
    class_type: 'KSampler',
    inputs: {
      model: modelRef,
      seed: params.seed,
      steps,
      cfg: 1,
      sampler_name: 'res_multistep',
      scheduler: 'simple',
      positive: [h3NodeId, 0],
      negative: ['zero_out', 0],
      latent_image: [h3NodeId, 1],
      denoise: 1,
    },
  } as WorkflowNode;

  Object.assign(nodes, audioToVideoNodes(modelRef, h3NodeId, params));
  return nodes;
}

export function buildText2Img(params: GenerationParams): Record<string, WorkflowNode> {
  const width = Math.min(4096, Math.max(64, Math.round(params.width / 32) * 32));
  const height = Math.min(4096, Math.max(64, Math.round(params.height / 32) * 32));

  return {
    '3': {
      class_type: 'KSampler',
      inputs: {
        cfg: params.cfg ?? 1,
        denoise: params.denoise ?? 1,
        latent_image: ['13', 0],
        model: ['11', 0],
        negative: ['33', 0],
        positive: ['27', 0],
        sampler_name: 'res_multistep',
        scheduler: 'simple',
        seed: params.seed,
        steps: params.steps,
      },
    },
    '11': {
      class_type: 'ModelSamplingAuraFlow',
      inputs: { model: ['28', 0], shift: 3 },
    },
    '13': {
      class_type: 'EmptySD3LatentImage',
      inputs: { width, height, batch_size: params.batch },
    },
    '27': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['30', 0], text: params.prompt },
    },
    '28': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: params.unetName || 'z_image_turbo_bf16.safetensors',
        weight_dtype: 'default',
      },
    },
    '29': {
      class_type: 'VAELoader',
      inputs: { vae_name: params.vaeName || 'ae.safetensors' },
    },
    '30': {
      class_type: 'CLIPLoader',
      inputs: {
        clip_name: params.clipName || 'qwen_3_4b.safetensors',
        type: 'lumina2',
      },
    },
    '33': {
      class_type: 'ConditioningZeroOut',
      inputs: { conditioning: ['27', 0] },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['29', 0] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: PREFIX, images: ['8', 0] },
    },
  };
}

export function buildImg2Img(params: GenerationParams): Record<string, WorkflowNode> {
  const width = Math.min(4096, Math.max(64, Math.round(params.width / 32) * 32));
  const height = Math.min(4096, Math.max(64, Math.round(params.height / 32) * 32));
  const imageName = params.imageName || '';

  return {
    '1': {
      class_type: 'LoadImage',
      inputs: { image: imageName },
    },
    '2': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['1', 0], vae: ['29', 0] },
    },
    '5': {
      class_type: 'LatentUpscale',
      inputs: {
        samples: ['2', 0],
        upscale_method: 'bislerp',
        width,
        height,
        crop: 'disabled',
      },
    },
    '6': {
      class_type: 'RepeatLatentBatch',
      inputs: { samples: ['5', 0], amount: params.batch },
    },
    '3': {
      class_type: 'KSampler',
      inputs: {
        cfg: params.cfg ?? 1,
        denoise: params.denoise ?? 0.6,
        latent_image: ['6', 0],
        model: ['11', 0],
        negative: ['33', 0],
        positive: ['27', 0],
        sampler_name: 'res_multistep',
        scheduler: 'simple',
        seed: params.seed,
        steps: params.steps,
      },
    },
    '11': {
      class_type: 'ModelSamplingAuraFlow',
      inputs: { model: ['28', 0], shift: 3 },
    },
    '27': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['30', 0], text: params.prompt },
    },
    '28': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: params.unetName || 'z_image_turbo_bf16.safetensors',
        weight_dtype: 'default',
      },
    },
    '29': {
      class_type: 'VAELoader',
      inputs: { vae_name: params.vaeName || 'ae.safetensors' },
    },
    '30': {
      class_type: 'CLIPLoader',
      inputs: { clip_name: params.clipName || 'qwen_3_4b.safetensors', type: 'lumina2' },
    },
    '33': {
      class_type: 'ConditioningZeroOut',
      inputs: { conditioning: ['27', 0] },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['29', 0] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: `${PREFIX}-img2img`, images: ['8', 0] },
    },
  };
}

export function buildText2Vid(params: GenerationParams): Record<string, WorkflowNode> {
  return buildVideoWorkflow(params, false);
}

export function buildImg2Vid(params: GenerationParams): Record<string, WorkflowNode> {
  const nodes = buildVideoWorkflow(params, true);
  if (params.firstFrameName) {
    nodes['load_first'] = {
      class_type: 'LoadImage',
      inputs: { image: params.firstFrameName },
    } as WorkflowNode;
  }
  if (params.lastFrameName) {
    nodes['load_last'] = {
      class_type: 'LoadImage',
      inputs: { image: params.lastFrameName },
    } as WorkflowNode;
  }
  return nodes;
}

export function buildImgUpscale(params: GenerationParams): Record<string, WorkflowNode> {
  const scale = params.scale ?? 4;
  const upscaleModel = params.upscaleModel || 'RealESRGAN_x4plus.safetensors';
  const imageName = params.imageName || '';

  const nodes: Record<string, WorkflowNode> = {
    '1': {
      class_type: 'LoadImage',
      inputs: { image: imageName },
    },
    '2': {
      class_type: 'ImageUpscaleWithModel',
      inputs: {
        upscale_model: ['3', 0],
        image: ['1', 0],
      },
    },
    '3': {
      class_type: 'UpscaleModelLoader',
      inputs: { model_name: upscaleModel },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: `${PREFIX}-upscaled`, images: ['2', 0] },
    },
  };

  if (scale === 2) {
    nodes['4'] = {
      class_type: 'ImageScale',
      inputs: {
        image: ['2', 0],
        upscale_method: 'lanczos',
        width: params.width,
        height: params.height,
        crop: 'disabled',
      },
    } as WorkflowNode;
    nodes['9'] = {
      class_type: 'SaveImage',
      inputs: { filename_prefix: `${PREFIX}-upscaled`, images: ['4', 0] },
    } as WorkflowNode;
  }

  return nodes;
}

export function buildVidUpscale(params: GenerationParams): Record<string, WorkflowNode> {
  const videoName = params.imageName || '';
  const vaeName = params.vaeName || 'seedvr2_ema_vae_fp16.safetensors';
  const steps = 20;
  const scale = params.scale ?? 2;

  const nodes: Record<string, WorkflowNode> = {
    '1': {
      class_type: 'LoadVideo',
      inputs: { file: videoName },
    },
    '2': {
      class_type: 'GetVideoComponents',
      inputs: { video: ['1', 0] },
    },
    'vid_resize': {
      class_type: 'ImageScaleBy',
      inputs: {
        image: ['2', 0],
        upscale_method: 'lanczos',
        scale_by: scale,
      },
    },
    '3': {
      class_type: 'VAELoader',
      inputs: { vae_name: vaeName },
    },
    '4': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: 'seedvr2_3b_int8_convrot.safetensors',
        weight_dtype: 'default',
      },
    },
    '5': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['vid_resize', 0], vae: ['3', 0] },
    },
    '6': {
      class_type: 'SeedVR2TemporalChunk',
      inputs: {
        latent: ['5', 0],
        temporal_overlap: 2,
        chunking_mode: 'auto',
      },
    },
    '7': {
      class_type: 'SeedVR2Conditioning',
      inputs: {
        model: ['4', 0],
        vae_conditioning: ['6', 0],
      },
    },
    '8': {
      class_type: 'KSampler',
      inputs: {
        model: ['4', 0],
        seed: params.seed,
        steps,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        positive: ['7', 0],
        negative: ['7', 1],
        latent_image: ['6', 0],
        denoise: 1,
      },
    },
    '9': {
      class_type: 'SeedVR2TemporalMerge',
      inputs: {
        latents: ['8', 0],
        temporal_overlap: 2,
      },
    },
    '10': {
      class_type: 'VAEDecode',
      inputs: { samples: ['9', 0], vae: ['3', 0] },
    },
    '11': {
      class_type: 'SeedVR2PostProcessing',
      inputs: {
        images: ['10', 0],
        original_resized_images: ['vid_resize', 0],
        color_correction_method: 'lab',
      },
    },
    '12': {
      class_type: 'CreateVideo',
      inputs: {
        images: ['11', 0],
        fps: ['2', 2],
        audio: ['2', 1],
      },
    },
    '13': {
      class_type: 'SaveVideo',
      inputs: {
        video: ['12', 0],
        filename_prefix: `${PREFIX}-vidupscale`,
        format: 'auto',
      },
    },
  };

  return nodes;
}

export function buildCustom(params: GenerationParams): Record<string, WorkflowNode> {
  return (params.customWorkflow as Record<string, WorkflowNode>) || {};
}

const templates: Record<Mode, WorkflowTemplate> = {
  text2img: { name: 'Z-Image-Turbo', mode: 'text2img', build: buildText2Img },
  img2img: { name: 'Z-Image-Turbo (Img2Img)', mode: 'img2img', build: buildImg2Img },
  text2vid: { name: 'MiniMax H3', mode: 'text2vid', build: buildText2Vid },
  img2vid: { name: 'MiniMax H3 (Img2Vid)', mode: 'img2vid', build: buildImg2Vid },
  img_upscale: { name: 'RealESRGAN', mode: 'img_upscale', build: buildImgUpscale },
  vid_upscale: { name: 'SeedVR2', mode: 'vid_upscale', build: buildVidUpscale },
  custom: { name: 'Custom Workflow', mode: 'custom', build: buildCustom },
};

export function getTemplate(mode: Mode): WorkflowTemplate {
  return templates[mode];
}

export function buildWorkflow(
  mode: Mode,
  params: GenerationParams
): Record<string, WorkflowNode> {
  return getTemplate(mode).build(params);
}
