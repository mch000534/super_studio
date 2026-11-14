import { useCallback, useEffect } from 'react';
import { useGenerationStore } from '@/stores/generation-store';
import { useQueueStore, type QueueTask } from '@/stores/queue-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useWebSocket } from '@/hooks/use-websocket';
import { comfyuiClient } from '@/lib/comfyui-client';
import { buildWorkflow } from '@/lib/workflow-templates';
import type { Mode, MediaItem, GenerationParams } from '@/types/workflow';
import type { FileInfo } from '@/types/comfyui';

// ComfyUI 的 SaveVideo 會把 MP4 放在 outputs.images（並附 animated 標記），
// 需依副檔名改判為 video，否則畫廊會以 <img> 渲染影片。
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi)$/i;

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
  TextEncodeQwenImage21: 'Qwen-Image-2.1 提示詞編碼',
  QwenImage21Cache: 'Qwen-Image-2.1 快取',
  EmptyLatentImage: '初始化潛在空間',
  // 音樂（MiniMax Music 3）
  MiniMaxMusic3TextEncode: '曲風與歌詞編碼',
  EmptyMiniMaxMusic3LatentAudio: '初始化音樂潛在空間',
  SaveAudioMP3: '儲存音樂檔案',
  ConditioningZeroOut: '負向條件清空',
  // 3D（TRELLIS 2）
  CLIPVisionLoader: '載入視覺編碼器',
  Trellis2Conditioning: '3D 影像條件',
  EmptyTrellis2LatentStructure: '初始化 3D 結構',
  VaeDecodeStructureTrellis2: '解碼 3D 結構',
  Trellis2ShapeStage: '3D 形狀生成',
  Trellis2UpsampleStage: '3D 形狀上採樣',
  VaeDecodeShapeTrellis: '解碼 3D 網格',
  Trellis2TextureStage: '3D 紋理生成',
  VaeDecodeTextureTrellis: '解碼 3D 紋理',
  GetMeshInfo: '讀取網格資訊',
  RemeshMesh: '網格重拓樑',
  DecimateMesh: '網格減面',
  MeshSmoothNormals: '平滑網格法線',
  UnwrapMesh: 'UV 展開',
  BakeTextureFromVoxel: '烘焙顏色貼圖',
  BakeAmbientOcclusion: '烘焙環境光遮蔽',
  BakeNormalMapFromMesh: '烘焙法線貼圖',
  ApplyTextureToMesh: '套用貼圖至網格',
  MeshToFile3D: '轉出 3D 檔案',
  SaveGLB: '儲存 GLB 模型',
  CFGOverride: 'CFG 調整',
  RescaleCFG: 'CFG 縮放',
  ModelSamplingSD3: '模型取樣設定',
  LoadBackgroundRemovalModel: '載入去背景模型',
  RemoveBackground: '移除背景',
  ImageCropToMask: '裁切主體',
  ComfySwitchNode: '圖形開關',
};

// 已提交工作流：prompt_id → 節點表，用於把 executing 事件的節點 id 轉成中文標籤
const submittedWorkflows = new Map<string, Record<string, { class_type: string }>>();

function rememberWorkflow(promptId: string, workflow: Record<string, { class_type: string }>) {
  submittedWorkflows.set(promptId, workflow);
  if (submittedWorkflows.size > 50) {
    const oldest = submittedWorkflows.keys().next().value;
    if (oldest) submittedWorkflows.delete(oldest);
  }
}

function nodeName(nodeId: string, promptId?: string): string {
  const workflow = promptId ? submittedWorkflows.get(promptId) : undefined;
  const classType = workflow?.[nodeId]?.class_type;
  const label = (classType && NODE_NAMES[classType]) || NODE_NAMES[nodeId];
  return label || `節點 #${nodeId}`;
}

let globalResultHandler: ((media: MediaItem[], mode: Mode, params: GenerationParams) => void) | null =
  null;

export function setResultHandler(
  handler: (media: MediaItem[], mode: Mode, params: GenerationParams) => void
): void {
  globalResultHandler = handler;
}

function syncGenerationStore(task: QueueTask | null) {
  const g = useGenerationStore.getState();
  if (!task) {
    g.resetGeneration();
    return;
  }
  g.setParams(task.params);
  g.setPromptId(task.promptId || '');
  g.setProgress(task.progressValue, task.progressMax);
  g.setCurrentNode(task.currentNode);
  if (task.error) g.setError(task.error);

  const statusMap: Record<string, typeof g.status> = {
    pending: 'queued',
    queued: 'queued',
    running: 'running',
    completed: 'success',
    failed: 'error',
    cancelled: 'interrupted',
  };
  g.setStatus(statusMap[task.status] || 'idle');
}

let latestSubmitNext: (() => Promise<void>) | null = null;
let submitLock = false;

export function useGeneration() {
  const { authHeader } = useSettingsStore();
  const ws = useWebSocket();

  const queueTasks = useQueueStore((s) => s.tasks);

  const isBusy = queueTasks.some(
    (t) => t.status === 'pending' || t.status === 'queued' || t.status === 'running'
  );

  const connect = useCallback(() => {
    const host = useSettingsStore.getState().comfyuiHost;
    if (host) ws.connect(host);
  }, [ws]);

  useEffect(() => {
    connect();
  }, [connect]);

  // Recover queue state on mount (e.g. a task completed while navigating pages
  // and its WebSocket events were missed).
  useEffect(() => {
    const q = useQueueStore.getState();
    if (!q.executingPromptId) {
      setTimeout(() => latestSubmitNext?.(), 0);
      return;
    }
    const executing = q.tasks.find((t) => t.promptId === q.executingPromptId);
    if (!executing) {
      useQueueStore.getState().setExecutingPromptId(null);
      setTimeout(() => latestSubmitNext?.(), 0);
      return;
    }
    syncGenerationStore(executing);
  }, []);

  useEffect(() => {
    const unsub = ws.onEvent((event) => {
      const q = useQueueStore.getState();
      const currentPromptId = q.executingPromptId;
      const runningTask = currentPromptId
        ? q.tasks.find((t) => t.promptId === currentPromptId)
        : q.tasks.find((t) => t.status === 'running' || t.status === 'queued');

      switch (event.type) {
        case 'status': {
          const data = event.data as { status?: { exec_info?: { queue_remaining?: number } } };
          useGenerationStore.getState().setQueueRemaining(
            data.status?.exec_info?.queue_remaining ?? 0
          );
          break;
        }
        case 'executing': {
          const data = event.data as { node?: string | null; prompt_id?: string };
          if (data.node === null) {
            // task finished — handled by execution_success / executing node===null below
          } else if (data.node) {
            if (runningTask) {
              const label = nodeName(data.node, data.prompt_id || currentPromptId || undefined);
              useQueueStore.getState().updateTask(runningTask.id, {
                currentNode: label,
                status: 'running',
              });
              syncGenerationStore({
                ...runningTask,
                currentNode: label,
                status: 'running',
              });
            }
          }
          break;
        }
        case 'progress': {
          const data = event.data as { value: number; max: number };
          if (data.max > 0 && runningTask) {
            useQueueStore.getState().updateTask(runningTask.id, {
              progressValue: data.value,
              progressMax: data.max,
            });
            syncGenerationStore({
              ...runningTask,
              progressValue: data.value,
              progressMax: data.max,
            });
          }
          break;
        }
        case 'execution_error': {
          const data = event.data as { exception_message?: string };
          if (runningTask) {
            useQueueStore.getState().updateTask(runningTask.id, {
              status: 'failed',
              error: data.exception_message || '執行發生錯誤',
              completedAt: Date.now(),
            });
            useQueueStore.getState().setExecutingPromptId(null);
            syncGenerationStore(null);
            setTimeout(() => latestSubmitNext?.(), 0);
          }
          break;
        }
        case 'execution_interrupted': {
          if (runningTask) {
            useQueueStore.getState().updateTask(runningTask.id, {
              status: 'cancelled',
              completedAt: Date.now(),
            });
            useQueueStore.getState().setExecutingPromptId(null);
            syncGenerationStore(null);
            setTimeout(() => latestSubmitNext?.(), 0);
          }
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

  const fetchResult = useCallback(
    async (promptId: string) => {
      const settings = useSettingsStore.getState();
      const q = useQueueStore.getState();
      const task = q.tasks.find((t) => t.promptId === promptId);
      if (!task) return;
      if (task.status === 'completed' || task.status === 'cancelled') return;

      const host = settings.comfyuiHost;
      const history = await comfyuiClient.getHistory(promptId, host, authHeader);

      const media: MediaItem[] = [];
      if (history.ok) {
        const entry = history.data[promptId];
        if (entry) {
          Object.values(entry.outputs || {}).forEach((output) => {
            const collect = (files: FileInfo[] | undefined, kind: MediaItem['kind']) => {
              (files || []).forEach((f) => {
                // ComfyUI 的 history outputs 包含所有節點的 UI 輸出：LoadVideo 等中間節點
                // 會回傳 type=input 的來源檔預覽，並非生成結果（曾導致放大影片在畫廊顯示兩次），
                // 因此只收集真正寫入 output 資料夾的檔案。
                if (f.type !== 'output') return;
                const resolvedKind: MediaItem['kind'] =
                  kind === 'image' && VIDEO_EXT.test(f.filename) ? 'video' : kind;
                media.push({
                  filename: f.filename,
                  subfolder: f.subfolder,
                  type: f.type,
                  kind: resolvedKind,
                  url: comfyuiClient.getViewUrl(f.filename, host, f.subfolder, f.type, {
                    authHeader,
                  }),
                  timestamp: Date.now(),
                });
              });
            };
            collect(output.images, 'image');
            collect(output.gifs, 'video');
            collect(output.audio, 'audio');
            collect(output['3d'], '3d');
          });
        }
      }

      if (media.length > 0) {
        globalResultHandler?.(media, task.params.mode, task.params);
      }

      useQueueStore.getState().updateTask(task.id, {
        status: 'completed',
        completedAt: Date.now(),
      });
      useQueueStore.getState().setExecutingPromptId(null);
      syncGenerationStore(null);
      // Advance to the next pending task
      setTimeout(() => latestSubmitNext?.(), 0);
    },
    [authHeader]
  );

  useEffect(() => {
    const unsub = ws.onEvent((event) => {
      if (event.type === 'execution_success' || event.type === 'executing') {
        const data = event.data as { prompt_id?: string; node?: string | null };
        if (event.type === 'execution_success' && data.prompt_id) {
          fetchResult(data.prompt_id);
        }
        if (event.type === 'executing' && data.node === null && data.prompt_id) {
          fetchResult(data.prompt_id);
        }
      }
    });
    return unsub;
  }, [ws, fetchResult]);

  const buildAndSubmit = useCallback(
    async (task: QueueTask): Promise<boolean> => {
      const settings = useSettingsStore.getState();
      const params = task.params;
      const mode = params.mode;
      const host = settings.comfyuiHost;

      if (!host) {
        useQueueStore.getState().updateTask(task.id, {
          status: 'failed',
          error: '尚未設定 ComfyUI 地址',
          completedAt: Date.now(),
        });
        return false;
      }

      let workflow = buildWorkflow(mode, params);
      if (mode === 'custom') {
        workflow = params.customWorkflow as Record<string, never>;
        if (!workflow || Object.keys(workflow).length === 0) {
          useQueueStore.getState().updateTask(task.id, {
            status: 'failed',
            error: '尚未載入自定義工作流',
            completedAt: Date.now(),
          });
          return false;
        }
      }

      useQueueStore.getState().updateTask(task.id, { status: 'queued' });

      const result = await comfyuiClient.queuePrompt(
        workflow,
        ws.clientId,
        host,
        authHeader
      );
      if (!result.ok) {
        useQueueStore.getState().updateTask(task.id, {
          status: 'failed',
          error: resolveError(result.error.message, result.error.nodeErrors),
          completedAt: Date.now(),
        });
        return false;
      }

      useQueueStore.getState().updateTask(task.id, {
        promptId: result.data.prompt_id,
        status: 'queued',
      });
      rememberWorkflow(result.data.prompt_id, workflow);

      // If nothing is executing, this becomes the running task
      const q = useQueueStore.getState();
      if (!q.executingPromptId) {
        useQueueStore.getState().setExecutingPromptId(result.data.prompt_id);
        useQueueStore.getState().updateTask(task.id, {
          status: 'running',
          progressValue: 0,
          progressMax: 0,
        });
        syncGenerationStore({
          ...task,
          promptId: result.data.prompt_id,
          status: 'running',
        });
      }

      return true;
    },
    [ws.clientId, authHeader]
  );

  const submitNext = useCallback(async () => {
    if (submitLock) return;
    submitLock = true;
    try {
      while (true) {
        const q = useQueueStore.getState();
        if (q.executingPromptId) break;

        const next = q.getNextPending();
        if (!next) break;

        const ok = await buildAndSubmit(next);
        if (!ok) continue;
        break;
      }
    } finally {
      submitLock = false;
    }
  }, [buildAndSubmit]);

  // Keep module-level ref for use in WS callbacks
  useEffect(() => {
    latestSubmitNext = submitNext;
  });

  const submit = useCallback(
    async (overrideParams?: Partial<GenerationParams>) => {
      const settings = useSettingsStore.getState();
      const g = useGenerationStore.getState();
      const mode = settings.currentMode;
      const params = { ...g.params, ...overrideParams, mode };

      if (!params.prompt.trim() && !['custom', 'img_upscale', 'vid_upscale', 'img23d'].includes(mode)) {
        g.setError('請輸入提示詞');
        return;
      }

      if (
        ['img2img', 'img_upscale', 'vid_upscale', 'img23d'].includes(mode) &&
        !params.imageName
      ) {
        g.setError('尚未選擇參考影像，無法生成');
        return;
      }

      if (mode === 'img_edit' && !(params.refImages?.length ?? 0)) {
        g.setError('尚未選擇參考圖片，無法編輯');
        return;
      }

      g.resetGeneration();
      useQueueStore.getState().addTask(params);

      await submitNext();
    },
    [submitNext]
  );

  const interrupt = useCallback(async () => {
    const q = useQueueStore.getState();
    const currentPromptId = q.executingPromptId;
    if (!currentPromptId) return;

    const task = q.tasks.find((t) => t.promptId === currentPromptId);
    if (task) {
      useQueueStore.getState().updateTask(task.id, {
        status: 'cancelled',
        completedAt: Date.now(),
      });
    }
    useQueueStore.getState().setExecutingPromptId(null);
    syncGenerationStore(null);

    const settings = useSettingsStore.getState();
    await comfyuiClient.interrupt(settings.comfyuiHost, authHeader);

    setTimeout(() => latestSubmitNext?.(), 0);
  }, [authHeader]);

  const cancelTask = useCallback(
    async (taskId: string) => {
      const q = useQueueStore.getState();
      const task = q.tasks.find((t) => t.id === taskId);
      if (!task) return;

      if (task.status === 'pending') {
        useQueueStore.getState().removeTask(taskId);
        return;
      }

      if (task.status === 'running' || task.status === 'queued') {
        if (q.executingPromptId === task.promptId) {
          const settings = useSettingsStore.getState();
          await comfyuiClient.interrupt(settings.comfyuiHost, authHeader);
          useQueueStore.getState().setExecutingPromptId(null);
          syncGenerationStore(null);
          setTimeout(() => latestSubmitNext?.(), 0);
        }
        useQueueStore.getState().updateTask(taskId, {
          status: 'cancelled',
          completedAt: Date.now(),
        });
      }
    },
    [authHeader]
  );

  const reset = useCallback(() => {
    useQueueStore.getState().setExecutingPromptId(null);
    useQueueStore.getState().clearCompleted();
    useGenerationStore.getState().resetGeneration();
  }, []);

  return { submit, interrupt, reset, isBusy, connect, cancelTask, submitNext };
}

function resolveError(message: string, nodeErrors?: Record<string, unknown>): string {
  if (!nodeErrors) return message;
  const nodes = Object.values(nodeErrors) as Array<{
    errors?: Array<{ message?: string; details?: string }>;
  }>;
  if (nodes.length === 0) return message;
  const details = nodes
    .map((n) => n.errors?.map((e) => e.details || e.message).join('; '))
    .filter(Boolean)
    .join(' | ');
  return details ? `${message}: ${details}` : message;
}
