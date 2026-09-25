import { create } from 'zustand';
import type { GenerationParams, GenerationStatus, Mode } from '@/types/workflow';

export function defaultParams(mode: Mode): GenerationParams {
  const base: GenerationParams = {
    prompt: '',
    negativePrompt: '',
    mode,
    seed: -1,
    width: 1024,
    height: 1024,
    steps: 8,
    cfg: 1,
    batch: 1,
    imageModelId: 'z-image',
  };
  return { ...base };
}

interface GenerationState {
  params: GenerationParams;
  status: GenerationStatus;
  progressValue: number;
  progressMax: number;
  currentNode: string;
  promptId: string;
  preview: string | null;
  error: string | null;
  queueRemaining: number;
  interruptRequested: boolean;

  setParams: (params: GenerationParams) => void;
  updateParams: (partial: Partial<GenerationParams>) => void;
  setStatus: (status: GenerationStatus) => void;
  setProgress: (value: number, max: number) => void;
  setCurrentNode: (node: string) => void;
  setPromptId: (id: string) => void;
  setPreview: (url: string | null) => void;
  setError: (error: string | null) => void;
  setQueueRemaining: (n: number) => void;
  setInterruptRequested: (b: boolean) => void;
  resetGeneration: () => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  params: defaultParams('text2img'),
  status: 'idle',
  progressValue: 0,
  progressMax: 0,
  currentNode: '',
  promptId: '',
  preview: null,
  error: null,
  queueRemaining: 0,
  interruptRequested: false,

  setParams: (params) => set({ params }),
  updateParams: (partial) => set((s) => ({ params: { ...s.params, ...partial } })),
  setStatus: (status) => set({ status }),
  setProgress: (progressValue, progressMax) => set({ progressValue, progressMax }),
  setCurrentNode: (currentNode) => set({ currentNode }),
  setPromptId: (promptId) => set({ promptId }),
  setPreview: (preview) => set({ preview }),
  setError: (error) => set({ error }),
  setQueueRemaining: (queueRemaining) => set({ queueRemaining }),
  setInterruptRequested: (interruptRequested) => set({ interruptRequested }),
  resetGeneration: () =>
    set({
      status: 'idle',
      progressValue: 0,
      progressMax: 0,
      currentNode: '',
      promptId: '',
      preview: null,
      error: null,
      interruptRequested: false,
    }),
}));
