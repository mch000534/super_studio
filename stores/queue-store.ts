import { create } from 'zustand';
import type { GenerationParams } from '@/types/workflow';

export type QueueTaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface QueueTask {
  id: string;
  params: GenerationParams;
  status: QueueTaskStatus;
  promptId?: string;
  progressValue: number;
  progressMax: number;
  currentNode: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

interface QueueState {
  tasks: QueueTask[];
  executingPromptId: string | null;

  addTask: (params: GenerationParams) => string;
  removeTask: (id: string) => void;
  removeTasks: (ids: string[]) => void;
  clearCompleted: () => void;
  updateTask: (id: string, update: Partial<QueueTask>) => void;
  moveTask: (id: string, direction: 'up' | 'down') => void;
  setExecutingPromptId: (promptId: string | null) => void;
  getNextPending: () => QueueTask | undefined;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  tasks: [],
  executingPromptId: null,

  addTask: (params) => {
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const task: QueueTask = {
      id,
      params: { ...params },
      status: 'pending',
      progressValue: 0,
      progressMax: 0,
      currentNode: '',
      createdAt: Date.now(),
    };
    set((s) => ({ tasks: [...s.tasks, task] }));
    return id;
  },

  removeTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  removeTasks: (ids) => {
    const idSet = new Set(ids);
    set((s) => ({ tasks: s.tasks.filter((t) => !idSet.has(t.id)) }));
  },

  clearCompleted: () => {
    set((s) => ({
      tasks: s.tasks.filter(
        (t) => t.status === 'pending' || t.status === 'queued' || t.status === 'running'
      ),
    }));
  },

  updateTask: (id, update) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...update } : t)),
    }));
  },

  moveTask: (id, direction) => {
    set((s) => {
      const tasks = [...s.tasks];
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) return s;

      const task = tasks[idx];
      if (task.status !== 'pending') return s;

      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= tasks.length) return s;
      if (tasks[targetIdx].status !== 'pending') return s;

      const temp = tasks[idx];
      tasks[idx] = tasks[targetIdx];
      tasks[targetIdx] = temp;
      return { tasks };
    });
  },

  setExecutingPromptId: (promptId) => {
    set({ executingPromptId: promptId });
  },

  getNextPending: () => {
    return get().tasks.find((t) => t.status === 'pending');
  },
}));

export function queuePendingCount(tasks: QueueTask[]): number {
  return tasks.filter(
    (t) => t.status === 'pending' || t.status === 'queued' || t.status === 'running'
  ).length;
}
