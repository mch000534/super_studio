import { useCallback, useEffect, useRef } from 'react';
import { useGenerationStore } from '@/stores/generation-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useWebSocket } from '@/hooks/use-websocket';
import { comfyuiClient } from '@/lib/comfyui-client';
import { buildWorkflow } from '@/lib/workflow-templates';
import type { Mode, MediaItem, GenerationParams } from '@/types/workflow';
import type { FileInfo } from '@/types/comfyui';

const NODE_NAMES: Record<string, string> = {
  KSampler: 'KSampler',
  CLIPTextEncode: '正/負向提示詞編碼',
  EmptySD3LatentImage: '初始化潛在空間',
  VAEDecode: 'VAE 解碼',
  SaveImage: '儲存圖片',
  SaveVideo: '儲存影片',
  MiniMaxH3ImageToVideo: '影片生成',
  VAEDecodeAudio: '音訊解碼',
  CreateVideo: '合成影片',
  ImageUpscaleWithModel: '模型放大',
  UpscaleModelLoader: '載入放大模型',
  SeedVR2: '影片放大',
  LoadImage: '載入圖片',
  LoadVideo: '載入影片',
  VAEEncode: 'VAE 編碼',
  ModelSamplingAuraFlow: '模型取樣',
  UNETLoader: '載入主模型',
  CLIPLoader: '載入文字編碼器',
  VAELoader: '載入 VAE',
};

function nodeName(nodeId: string): string {
  return NODE_NAMES[nodeId] || `節點 #${nodeId}`;
}

export function useGeneration(onResult?: (media: MediaItem[], mode: Mode) => void) {
  const store = useGenerationStore();
  const { authHeader } = useSettingsStore();
  const ws = useWebSocket();
  const onResultRef = useRef(onResult);
  const handledPromptRef = useRef<string | null>(null);
  const fetchInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const isBusy = store.status === 'queued' || store.status === 'running';

  const connect = useCallback(() => {
    const host = useSettingsStore.getState().comfyuiHost;
    if (host) ws.connect(host);
  }, [ws]);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    const unsub = ws.onEvent((event) => {
      const g = useGenerationStore.getState();
      switch (event.type) {
        case 'status': {
          const data = event.data as { status?: { exec_info?: { queue_remaining?: number } } };
          g.setQueueRemaining(data.status?.exec_info?.queue_remaining ?? 0);
          break;
        }
        case 'executing': {
          const data = event.data as { node?: string | null; prompt_id?: string };
          if (data.node === null) {
            // which prompt finished?
          } else if (data.node) {
            g.setCurrentNode(nodeName(data.node));
          }
          break;
        }
        case 'progress': {
          const data = event.data as { value: number; max: number };
          if (data.max > 0 && g.status !== 'idle') {
            g.setProgress(data.value, data.max);
          }
          break;
        }
        case 'execution_error': {
          const data = event.data as { exception_message?: string };
          g.setStatus('error');
          g.setError(data.exception_message || '執行發生錯誤');
          break;
        }
        case 'execution_interrupted': {
          g.setStatus('interrupted');
          break;
        }
      }
    });
    return unsub;
  }, [ws]);

  useEffect(() => {
    const unsub = ws.onPreview((url) => {
      useGenerationStore.getState().setPreview(url);
    });
    return unsub;
  }, [ws]);

  const submit = useCallback(
    async (overrideParams?: Partial<GenerationParams>) => {
      const settings = useSettingsStore.getState();
      const g = useGenerationStore.getState();
      const mode = settings.currentMode;
      const params = { ...g.params, ...overrideParams, mode };

      if (!params.prompt.trim() && !['img_upscale', 'vid_upscale'].includes(mode)) {
        g.setError('請輸入提示詞');
        return;
      }

      g.resetGeneration();
      g.setParams(params);
      g.setStatus('queued');

      let workflow = buildWorkflow(mode, params);

      if (mode === 'custom') {
        workflow = params.customWorkflow as Record<string, never>;
        if (!workflow || Object.keys(workflow).length === 0) {
          g.setError('尚未載入自定義工作流');
          g.setStatus('error');
          return;
        }
      }

      const clientId = ws.clientId;
      const host = settings.comfyuiHost;
      if (!host) {
        g.setError('尚未設定 ComfyUI 地址');
        g.setStatus('error');
        return;
      }

      const result = await comfyuiClient.queuePrompt(workflow, clientId, host, authHeader);
      if (!result.ok) {
        g.setStatus('error');
        g.setError(resolveError(result.error.message, result.error.nodeErrors));
        return;
      }

      g.setPromptId(result.data.prompt_id);
      g.setStatus('running');
    },
    [ws.clientId, authHeader]
  );

  const interrupt = useCallback(async () => {
    const g = useGenerationStore.getState();
    const settings = useSettingsStore.getState();
    g.setInterruptRequested(true);
    const result = await comfyuiClient.interrupt(settings.comfyuiHost, authHeader);
    if (!result.ok) {
      g.setError(result.error.message);
    }
    g.setInterruptRequested(false);
  }, [authHeader]);

  const fetchResult = useCallback(async () => {
    const g = useGenerationStore.getState();
    const settings = useSettingsStore.getState();
    if (!g.promptId) return;
    if (handledPromptRef.current === g.promptId) return;
    if (fetchInFlightRef.current === g.promptId) return;
    fetchInFlightRef.current = g.promptId;
    const host = settings.comfyuiHost;
    const history = await comfyuiClient.getHistory(g.promptId, host, authHeader);
    fetchInFlightRef.current = null;
    if (!history.ok) return;

    const entry = history.data[g.promptId];
    if (!entry) return;

    const media: MediaItem[] = [];
    Object.values(entry.outputs || {}).forEach((output) => {
      const collect = (files: FileInfo[] | undefined, kind: 'image' | 'video') => {
        (files || []).forEach((f) => {
          media.push({
            filename: f.filename,
            subfolder: f.subfolder,
            type: f.type,
            kind,
            url: comfyuiClient.getViewUrl(f.filename, host, f.subfolder, f.type, {
              authHeader,
            }),
            timestamp: Date.now(),
          });
        });
      };
      collect(output.images, 'image');
      collect(output.gifs, 'video');
    });

    if (media.length > 0) {
      handledPromptRef.current = g.promptId;
      onResultRef.current?.(media, g.params.mode);
      g.setStatus('success');
    }
  }, [authHeader]);

  useEffect(() => {
    const unsub = ws.onEvent((event) => {
      if (event.type === 'execution_success' || event.type === 'executing') {
        const data = event.data as { prompt_id?: string; node?: string | null };
        const g = useGenerationStore.getState();
        if (event.type === 'execution_success' && g.promptId === data.prompt_id) {
          fetchResult();
        }
        if (event.type === 'executing' && data.node === null && g.promptId === data.prompt_id) {
          fetchResult();
        }
      }
    });
    return unsub;
  }, [ws, fetchResult]);

  const reset = useCallback(() => {
    useGenerationStore.getState().resetGeneration();
  }, []);

  return { submit, interrupt, reset, isBusy, connect };
}

function resolveError(message: string, nodeErrors?: Record<string, unknown>): string {
  if (!nodeErrors) return message;
  const nodes = Object.values(nodeErrors) as Array<{ errors?: Array<{ message?: string }> }>;
  if (nodes.length === 0) return message;
  const details = nodes
    .map((n) => n.errors?.map((e) => e.message).join('; '))
    .filter(Boolean)
    .join(' | ');
  return details ? `${message}: ${details}` : message;
}
