import { useCallback, useEffect } from 'react';
import { useGenerationStore } from '@/stores/generation-store';
import { useQueueStore, type QueueTask } from '@/stores/queue-store';
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
              useQueueStore.getState().updateTask(runningTask.id, {
                currentNode: nodeName(data.node),
                status: 'running',
              });
              syncGenerationStore({
                ...runningTask,
                currentNode: nodeName(data.node),
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

      if (!params.prompt.trim() && !['custom', 'img_upscale', 'vid_upscale'].includes(mode)) {
        g.setError('請輸入提示詞');
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
  const nodes = Object.values(nodeErrors) as Array<{ errors?: Array<{ message?: string }> }>;
  if (nodes.length === 0) return message;
  const details = nodes
    .map((n) => n.errors?.map((e) => e.message).join('; '))
    .filter(Boolean)
    .join(' | ');
  return details ? `${message}: ${details}` : message;
}
