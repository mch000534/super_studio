import type { GenerationParams, Mode } from '@/types/workflow';
import type { WorkflowNode } from '@/types/comfyui';
import { getImageModelFamily } from '@/lib/image-models';
import { getVideoModelFamily } from '@/lib/video-models';

export interface WorkflowTemplate {
  name: string;
  mode: Mode;
  build: (params: GenerationParams) => Record<string, WorkflowNode>;
}

const PREFIX = 'SuperStudio';

export function resolveSeed(seed: number): number {
  return Number.isFinite(seed) && seed >= 0 ? Math.floor(seed) : Math.floor(Math.random() * 1_000_000_000);
}

export function frameCountForDuration(seconds: number): number {
  const desired = Math.max(5, Math.round(seconds * 24));
  const k = Math.max(0, Math.ceil((desired - 5) / 17));
  return 17 * k + 5;
}

function baseVideoNodes(params: GenerationParams): Record<string, WorkflowNode> {
  const { unetName, clipName, vaeName, audioVaeName } = params;
  const family = getVideoModelFamily(params.videoModelId);
  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: unetName || family.defaults.unetName,
        weight_dtype: 'default',
      },
    },
    '2': {
      class_type: 'CLIPLoader',
      inputs: {
        clip_name: clipName || family.defaults.clipName,
        type: 'minimax',
      },
    },
    '3': {
      class_type: 'VAELoader',
      inputs: { vae_name: vaeName || family.defaults.vaeName },
    },
    '4': {
      class_type: 'VAELoader',
      inputs: { vae_name: audioVaeName || family.defaults.audioVaeName },
    },
  };
}

function audioToVideoNodes(
  samplesNodeId: string,
  params: GenerationParams
): Record<string, WorkflowNode> {
  const fps = params.fps ?? 24;
  return {
    'vae_decode': {
      class_type: 'VAEDecode',
      inputs: { samples: [samplesNodeId, 0], vae: ['3', 0] },
    },
    'vae_decode_audio': {
      class_type: 'VAEDecodeAudio',
      inputs: { samples: [samplesNodeId, 0], vae: ['4', 0] },
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

/** 對齊到 32 的倍數（ComfyUI 影像尺寸需求）。 */
function snap32(n: number): number {
  return Math.min(4096, Math.max(32, Math.round(n / 32) * 32));
}

/**
 * FastVideo FastH3：DMD2 蒸餾 8 步模型，使用 VSA 稀疏注意力。
 * 依官方 ComfyUI 範本（First Last Frame to Video）組圖：
 * UNETLoader → MiniMaxH3SigmaShift → ModelAttentionBackend → BlockSparseAttention
 *   → BasicScheduler / BasicGuider → SamplerCustomAdvanced → VAEDecode(+Audio)
 *   → CreateVideo → SaveVideo
 */
function buildFastH3VideoWorkflow(
  params: GenerationParams,
  withFrames: boolean
): Record<string, WorkflowNode> {
  const nodes = baseVideoNodes(params);
  const width = snap32(params.width);
  const height = snap32(params.height);
  const length = frameCountForDuration(params.duration ?? 5);

  nodes['sigma_shift'] = {
    class_type: 'MiniMaxH3SigmaShift',
    inputs: { model: ['1', 0], shift_video: 10, shift_audio: 3 },
  } as WorkflowNode;

  nodes['attn_backend'] = {
    class_type: 'ModelAttentionBackend',
    inputs: { model: ['sigma_shift', 0], attention: 'comfy kitchen attention' },
  } as WorkflowNode;

  nodes['sparse_attn'] = {
    class_type: 'BlockSparseAttention',
    inputs: {
      model: ['attn_backend', 0],
      selection: 'vsa',
      'selection.keep_percent': 10,
      start_percent: 0.2,
      end_percent: 1,
      dense_blocks: '',
      min_tokens: 12288,
      extra_tokens: 256,
      sink_conditioning: 'exact_kv_and_rows',
      verbose: false,
    },
  } as WorkflowNode;

  const h3Inputs: Record<string, unknown> = {
    clip: ['2', 0],
    vae: ['3', 0],
    prompt: params.prompt,
    width,
    height,
    length,
  };
  if (withFrames) {
    if (params.firstFrameName) h3Inputs['first_frame'] = ['load_first', 0];
    if (params.lastFrameName) h3Inputs['last_frame'] = ['load_last', 0];
  }
  nodes['h3'] = {
    class_type: 'MiniMaxH3ImageToVideo',
    inputs: h3Inputs,
  } as WorkflowNode;

  nodes['scheduler'] = {
    class_type: 'BasicScheduler',
    inputs: { model: ['sparse_attn', 0], scheduler: 'simple', steps: 8, denoise: 1 },
  } as WorkflowNode;

  nodes['guider'] = {
    class_type: 'BasicGuider',
    inputs: { model: ['sparse_attn', 0], conditioning: ['h3', 0] },
  } as WorkflowNode;

  nodes['sampler_select'] = {
    class_type: 'KSamplerSelect',
    inputs: { sampler_name: 'res_multistep' },
  } as WorkflowNode;

  nodes['noise'] = {
    class_type: 'RandomNoise',
    inputs: { noise_seed: resolveSeed(params.seed) },
  } as WorkflowNode;

  nodes['sampler'] = {
    class_type: 'SamplerCustomAdvanced',
    inputs: {
      noise: ['noise', 0],
      guider: ['guider', 0],
      sampler: ['sampler_select', 0],
      sigmas: ['scheduler', 0],
      latent_image: ['h3', 1],
    },
  } as WorkflowNode;

  Object.assign(nodes, audioToVideoNodes('sampler', params));
  return nodes;
}

function buildVideoWorkflow(params: GenerationParams, withFrames: boolean): Record<string, WorkflowNode> {
  if (getVideoModelFamily(params.videoModelId).id === 'fastvideo-fasth3') {
    return buildFastH3VideoWorkflow(params, withFrames);
  }

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
      seed: resolveSeed(params.seed),
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

  Object.assign(nodes, audioToVideoNodes('ks_turbo', params));
  return nodes;
}

function withFamilyModels(params: GenerationParams): GenerationParams {
  const family = getImageModelFamily(params.imageModelId);
  return {
    ...params,
    unetName: family.defaults.unetName,
    clipName: family.defaults.clipName,
    vaeName: family.defaults.vaeName,
  };
}

export function buildText2Img(params: GenerationParams): Record<string, WorkflowNode> {
  const familyParams = withFamilyModels(params);
  if (getImageModelFamily(params.imageModelId).kind === 'qwen-image-2.1') {
    return buildQwenImage21T2i(familyParams);
  }
  return buildZImageT2i(familyParams);
}

export function buildZImageT2i(params: GenerationParams): Record<string, WorkflowNode> {
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
        seed: resolveSeed(params.seed),
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
        seed: resolveSeed(params.seed),
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

export function buildQwenImage21T2i(params: GenerationParams): Record<string, WorkflowNode> {
  const width = Math.min(4096, Math.max(64, Math.round(params.width / 32) * 32));
  const height = Math.min(4096, Math.max(64, Math.round(params.height / 32) * 32));

  return {
    '451': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: params.unetName || 'qwen_image_2.1_int8_convrot.safetensors',
        weight_dtype: 'default',
      },
    } as WorkflowNode,
    '452': {
      class_type: 'TextEncodeQwenImage21',
      inputs: {
        clip: ['453', 0],
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || '',
        resolution: width,
      },
    } as WorkflowNode,
    '453': {
      class_type: 'CLIPLoader',
      inputs: {
        clip_name: params.clipName || 'qwen3vl_8b_int8_convrot.safetensors',
        type: 'qwen_image',
        device: 'default',
      },
    } as WorkflowNode,
    '454': {
      class_type: 'VAELoader',
      inputs: {
        vae_name: params.vaeName || 'qwen_image_2.1_vae_bf16.safetensors',
      },
    } as WorkflowNode,
    '456': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width,
        height,
        batch_size: params.batch,
      },
    } as WorkflowNode,
    '458': {
      class_type: 'KSampler',
      inputs: {
        model: ['451', 0],
        seed: resolveSeed(params.seed),
        steps: params.steps,
        cfg: params.cfg ?? 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        positive: ['452', 0],
        negative: ['452', 1],
        latent_image: ['456', 0],
        denoise: 1,
      },
    } as WorkflowNode,
    '457': {
      class_type: 'VAEDecode',
      inputs: { samples: ['458', 0], vae: ['454', 0] },
    } as WorkflowNode,
    '461': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: `${PREFIX}-qwen_image_2.1`, images: ['457', 0] },
    } as WorkflowNode,
  };
}

export function buildQwenImage21Edit(params: GenerationParams): Record<string, WorkflowNode> {
  const familyParams = withFamilyModels({ ...params, imageModelId: 'qwen-image-2.1' });
  const refs = (params.refImages ?? []).filter(Boolean).slice(0, 10);

  const teInputs: Record<string, unknown> = {
    clip: ['453', 0],
    prompt: params.prompt,
    negative_prompt: params.negativePrompt || '',
    vae: ['454', 0],
    resolution: params.resolution ?? 1024,
  };

  const nodes: Record<string, WorkflowNode> = {
    '451': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: familyParams.unetName || 'qwen_image_2.1_int8_convrot.safetensors',
        weight_dtype: 'default',
      },
    } as WorkflowNode,
    '453': {
      class_type: 'CLIPLoader',
      inputs: {
        clip_name: familyParams.clipName || 'qwen3vl_8b_int8_convrot.safetensors',
        type: 'qwen_image',
        device: 'default',
      },
    } as WorkflowNode,
    '454': {
      class_type: 'VAELoader',
      inputs: {
        vae_name: familyParams.vaeName || 'qwen_image_2.1_vae_bf16.safetensors',
      },
    } as WorkflowNode,
    '469': {
      class_type: 'QwenImage21Cache',
      inputs: {
        model: ['451', 0],
        device: 'auto',
        dtype: 'default',
      },
    } as WorkflowNode,
  };

  refs.forEach((name, idx) => {
    const loadId = String(470 + idx);
    nodes[loadId] = {
      class_type: 'LoadImage',
      inputs: { image: name },
    } as WorkflowNode;
    teInputs[`images.image_${idx + 1}`] = [loadId, 0];
  });

  nodes['474'] = {
    class_type: 'TextEncodeQwenImage21',
    inputs: teInputs,
  } as WorkflowNode;

  nodes['458'] = {
    class_type: 'KSampler',
    inputs: {
      model: ['469', 0],
      seed: resolveSeed(params.seed),
      steps: params.steps,
      cfg: params.cfg ?? 1,
      sampler_name: 'euler',
      scheduler: 'simple',
      positive: ['474', 0],
      negative: ['474', 1],
      latent_image: ['474', 2],
      denoise: 1,
    },
  } as WorkflowNode;

  nodes['457'] = {
    class_type: 'VAEDecode',
    inputs: { samples: ['458', 0], vae: ['454', 0] },
  } as WorkflowNode;

  nodes['461'] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: `${PREFIX}-qwen21-edit`, images: ['457', 0] },
  } as WorkflowNode;

  return nodes;
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
        seed: resolveSeed(params.seed),
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

export function buildText2Music(params: GenerationParams): Record<string, WorkflowNode> {
  // MiniMax Music 3（對照本機 ComfyUI workflow template：audio_minimax_music_3）
  const duration = Math.min(300, Math.max(5, Math.round(params.duration ?? 60)));
  const seed = resolveSeed(params.seed);

  return {
    'm1': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: 'minimax_music3_dit_fp16.safetensors',
        weight_dtype: 'default',
      },
    },
    'm2': {
      class_type: 'CLIPLoader',
      inputs: {
        clip_name: 'minimax_music3_text_encoder_pruned_int8_convrot.safetensors',
        type: 'minimax',
        weight_dtype: 'default',
      },
    },
    'm3': {
      class_type: 'VAELoader',
      inputs: { vae_name: 'minimax_music3_dav.safetensors' },
    },
    'm4': {
      class_type: 'MiniMaxMusic3TextEncode',
      inputs: {
        clip: ['m2', 0],
        caption: params.prompt,
        lyrics: params.lyrics || '',
        seed,
        max_duration: duration,
        cfg_scale: 1.7,
        top_k: 50,
      },
    },
    'm5': {
      class_type: 'ConditioningZeroOut',
      inputs: { conditioning: ['m4', 0] },
    },
    'm6': {
      class_type: 'EmptyMiniMaxMusic3LatentAudio',
      inputs: { seconds: ['m4', 1], batch_size: 1 },
    },
    'm7': {
      class_type: 'KSampler',
      inputs: {
        model: ['m1', 0],
        seed,
        steps: 30,
        cfg: 1.7,
        sampler_name: 'euler',
        scheduler: 'simple',
        positive: ['m4', 0],
        negative: ['m5', 0],
        latent_image: ['m6', 0],
        denoise: 1,
      },
    },
    'm8': {
      class_type: 'VAEDecodeAudio',
      inputs: { samples: ['m7', 0], vae: ['m3', 0] },
    },
    'm9': {
      class_type: 'SaveAudioMP3',
      inputs: {
        audio: ['m8', 0],
        filename_prefix: `${PREFIX}-music`,
        quality: '320k',
      },
    },
  };
}

export function buildImg23D(params: GenerationParams): Record<string, WorkflowNode> {
  // TRELLIS 2（對照本機 ComfyUI workflow template：3d_pixal3d_trellis2_image_to_model）
  // 管線：去背景 → 方形裁切 → 結構 → 形狀 → 上採樣 → 紋理 → 重拓樑/UV 展開 → 貼圖烘焙 → GLB
  const seed = resolveSeed(params.seed);

  return {
    // --- 預處理：去背景 + 方形裁切 ---
    'load_image': {
      class_type: 'LoadImage',
      inputs: { image: params.imageName || '' },
    },
    'load_bg': {
      class_type: 'LoadBackgroundRemovalModel',
      inputs: { bg_removal_name: 'birefnet.safetensors' },
    },
    'remove_bg': {
      class_type: 'RemoveBackground',
      inputs: { bg_removal_model: ['load_bg', 0], image: ['load_image', 0] },
    },
    'mask': {
      class_type: 'ComfySwitchNode',
      inputs: { switch: true, on_false: ['load_image', 1], on_true: ['remove_bg', 0] },
    },
    'crop': {
      class_type: 'ImageCropToMask',
      inputs: {
        images: ['load_image', 0],
        masks: ['mask', 0],
        width: 1024,
        height: 1024,
        pad_factor: 1.1,
        grow_mask: 0,
        background: '#000000',
      },
    },

    // --- 影像條件 ---
    'clip_vision': {
      class_type: 'CLIPVisionLoader',
      inputs: { clip_name: 'dino_v3_L_naf_fp32.safetensors' },
    },
    'cond': {
      class_type: 'Trellis2Conditioning',
      inputs: { clip_vision_model: ['clip_vision', 0], image: ['crop', 0] },
    },

    // --- 模型 ---
    'shape_vae': {
      class_type: 'VAELoader',
      inputs: { vae_name: 'trellis_2_shape_vae_bf16.safetensors' },
    },
    'texture_vae': {
      class_type: 'VAELoader',
      inputs: { vae_name: 'trellis_2_texture_vae_bf16.safetensors' },
    },
    'unet': {
      class_type: 'UNETLoader',
      inputs: { unet_name: 'trellis_2_int8_convrot.safetensors', weight_dtype: 'default' },
    },

    // --- 結構階段 ---
    'cfg_s': {
      class_type: 'CFGOverride',
      inputs: { model: ['unet', 0], cfg: 1, start_percent: 0.667, end_percent: 1 },
    },
    'rescale_s': {
      class_type: 'RescaleCFG',
      inputs: { model: ['cfg_s', 0], multiplier: 0.7 },
    },
    'model_s': {
      class_type: 'ModelSamplingSD3',
      inputs: { model: ['rescale_s', 0], shift: 5 },
    },
    'empty_s': {
      class_type: 'EmptyTrellis2LatentStructure',
      inputs: { batch_size: 1 },
    },
    'ks_s': {
      class_type: 'KSampler',
      inputs: {
        model: ['model_s', 0],
        seed,
        steps: 12,
        cfg: 7.5,
        sampler_name: 'euler',
        scheduler: 'normal',
        positive: ['cond', 0],
        negative: ['cond', 1],
        latent_image: ['empty_s', 0],
        denoise: 1,
      },
    },
    'dec_s': {
      class_type: 'VaeDecodeStructureTrellis2',
      inputs: { samples: ['ks_s', 0], vae: ['shape_vae', 0], resolution: '32' },
    },

    // --- 形狀階段 ---
    'cfg_sh': {
      class_type: 'CFGOverride',
      inputs: { model: ['unet', 0], cfg: 1, start_percent: 0.769, end_percent: 1 },
    },
    'rescale_sh': {
      class_type: 'RescaleCFG',
      inputs: { model: ['cfg_sh', 0], multiplier: 0.5 },
    },
    'shape_stage': {
      class_type: 'Trellis2ShapeStage',
      inputs: { positive: ['cond', 0], negative: ['cond', 1], voxel: ['dec_s', 0] },
    },
    'ks_sh': {
      class_type: 'KSampler',
      inputs: {
        model: ['rescale_sh', 0],
        seed,
        steps: 20,
        cfg: 7.5,
        sampler_name: 'euler',
        scheduler: 'normal',
        positive: ['shape_stage', 0],
        negative: ['shape_stage', 1],
        latent_image: ['shape_stage', 2],
        denoise: 1,
      },
    },
    'upsample': {
      class_type: 'Trellis2UpsampleStage',
      inputs: {
        positive: ['shape_stage', 0],
        negative: ['shape_stage', 1],
        shape_latent: ['ks_sh', 0],
        vae: ['shape_vae', 0],
        target_resolution: '1536',
      },
    },
    'ks_sh2': {
      class_type: 'KSampler',
      inputs: {
        model: ['rescale_sh', 0],
        seed,
        steps: 12,
        cfg: 7.5,
        sampler_name: 'euler',
        scheduler: 'simple',
        positive: ['upsample', 0],
        negative: ['upsample', 1],
        latent_image: ['upsample', 2],
        denoise: 1,
      },
    },
    'dec_shape': {
      class_type: 'VaeDecodeShapeTrellis',
      inputs: { samples: ['ks_sh2', 0], vae: ['shape_vae', 0] },
    },

    // --- 紋理階段 ---
    'tex_stage': {
      class_type: 'Trellis2TextureStage',
      inputs: {
        positive: ['upsample', 0],
        negative: ['upsample', 1],
        shape_latent: ['ks_sh2', 0],
      },
    },
    'ks_tex': {
      class_type: 'KSampler',
      inputs: {
        model: ['unet', 0],
        seed,
        steps: 12,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'normal',
        positive: ['tex_stage', 0],
        negative: ['tex_stage', 1],
        latent_image: ['tex_stage', 2],
        denoise: 1,
      },
    },
    'dec_tex': {
      class_type: 'VaeDecodeTextureTrellis',
      inputs: {
        samples: ['ks_tex', 0],
        vae: ['texture_vae', 0],
        shape_subdivides: ['dec_shape', 1],
      },
    },

    // --- 網格處理與 UV 貼圖烘焙 ---
    'mesh_info': {
      class_type: 'GetMeshInfo',
      inputs: { mesh: ['dec_shape', 0] },
    },
    'remesh': {
      class_type: 'RemeshMesh',
      inputs: {
        mesh: ['mesh_info', 0],
        resolution: 768,
        sign_mode: 'udf',
        'sign_mode.qef': false,
        'sign_mode.drop_inverted_components': false,
        'sign_mode.drop_enclosed_components': false,
        band: 1,
        project_back: 0,
        fix_poles: false,
        smooth_iters: 20,
        drop_small_components: 0.01,
        precluster_max_verts: 20000000,
      },
    },
    'decimate': {
      class_type: 'DecimateMesh',
      inputs: { mesh: ['remesh', 0], target_face_count: 700000, placement_mode: 'midpoint' },
    },
    'smooth': {
      class_type: 'MeshSmoothNormals',
      inputs: { mesh: ['decimate', 0], crease_angle: 180 },
    },
    'unwrap': {
      class_type: 'UnwrapMesh',
      inputs: {
        mesh: ['smooth', 0],
        segmenter: 'pec',
        resolution: 4096,
        padding: 1,
        weld_distance: 0.0002,
      },
    },
    'bake_color': {
      class_type: 'BakeTextureFromVoxel',
      inputs: {
        mesh: ['unwrap', 0],
        voxel_colors: ['dec_tex', 0],
        reference_mesh: ['dec_shape', 0],
        texture_size: 4096,
      },
    },
    'bake_ao': {
      class_type: 'BakeAmbientOcclusion',
      inputs: {
        low_poly: ['unwrap', 0],
        high_poly: ['remesh', 0],
        resolution: 1024,
        samples: 64,
        max_distance: 0.71,
        strength: 1,
        bias: 0.01,
      },
    },
    'bake_normal': {
      class_type: 'BakeNormalMapFromMesh',
      inputs: {
        low_poly: ['unwrap', 0],
        high_poly: ['remesh', 0],
        resolution: 2048,
        cage_distance: 0.05,
        ignore_backfaces: true,
      },
    },
    'apply': {
      class_type: 'ApplyTextureToMesh',
      inputs: {
        mesh: ['unwrap', 0],
        base_color: ['bake_color', 0],
        metallic: ['bake_color', 1],
        roughness: ['bake_color', 2],
        occlusion: ['bake_ao', 0],
        normal_map: ['bake_normal', 0],
      },
    },
    'smooth2': {
      class_type: 'MeshSmoothNormals',
      inputs: { mesh: ['apply', 0], crease_angle: 180 },
    },
    'mesh_file': {
      class_type: 'MeshToFile3D',
      inputs: { mesh: ['smooth2', 0] },
    },
    'save': {
      class_type: 'SaveGLB',
      inputs: { mesh: ['mesh_file', 0], filename_prefix: `${PREFIX}-3d` },
    },
  };
}

export function buildCustom(params: GenerationParams): Record<string, WorkflowNode> {
  return (params.customWorkflow as Record<string, WorkflowNode>) || {};
}

const templates: Record<Mode, WorkflowTemplate> = {
  text2img: { name: 'Text to Image', mode: 'text2img', build: buildText2Img },
  img2img: { name: 'Z-Image-Turbo (Img2Img)', mode: 'img2img', build: buildImg2Img },
  img_edit: { name: 'Qwen-Image-2.1 (Image Edit)', mode: 'img_edit', build: buildQwenImage21Edit },
  text2vid: { name: 'MiniMax H3 / FastVideo FastH3', mode: 'text2vid', build: buildText2Vid },
  img2vid: {
    name: 'MiniMax H3 / FastVideo FastH3 (Img2Vid)',
    mode: 'img2vid',
    build: buildImg2Vid,
  },
  img_upscale: { name: 'RealESRGAN', mode: 'img_upscale', build: buildImgUpscale },
  vid_upscale: { name: 'SeedVR2', mode: 'vid_upscale', build: buildVidUpscale },
  text2music: { name: 'MiniMax Music 3', mode: 'text2music', build: buildText2Music },
  img23d: { name: 'TRELLIS 2 (Img to 3D)', mode: 'img23d', build: buildImg23D },
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
