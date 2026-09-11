import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Mode } from '@/types/workflow';
import { getItem, setItem } from '@/lib/storage';

interface SettingsState {
  comfyuiHost: string;
  authHeader?: string;
  theme: 'light' | 'dark' | 'system';
  currentMode: Mode;
  llmBaseUrl: string;
  llmApiKey?: string;
  llmModel: string;
  setHost: (host: string) => void;
  setAuthHeader: (header?: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setMode: (mode: Mode) => void;
  setLlmBaseUrl: (baseUrl: string) => void;
  setLlmApiKey: (apiKey?: string) => void;
  setLlmModel: (model: string) => void;
}

export const DEFAULT_HOST = 'http://127.0.0.1:8188';
export const DEFAULT_LLM_MODEL = 'qwen3-vl:4b';

export function getDefaultHost(): string {
  if (typeof window === 'undefined' || !window.location.hostname) return DEFAULT_HOST;
  return `http://${window.location.hostname}:8188`;
}

export function getDefaultLlmBaseUrl(): string {
  if (typeof window === 'undefined' || !window.location.hostname) return 'http://127.0.0.1:11434/v1';
  return `http://${window.location.hostname}:11434/v1`;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      comfyuiHost: getDefaultHost(),
      theme: 'system',
      currentMode: 'text2img',
      llmBaseUrl: getDefaultLlmBaseUrl(),
      llmApiKey: undefined,
      llmModel: DEFAULT_LLM_MODEL,
      setHost: (comfyuiHost) => set({ comfyuiHost }),
      setAuthHeader: (authHeader) => set({ authHeader }),
      setTheme: (theme) => set({ theme }),
      setMode: (currentMode) => set({ currentMode }),
      setLlmBaseUrl: (llmBaseUrl) => set({ llmBaseUrl }),
      setLlmApiKey: (llmApiKey) => set({ llmApiKey }),
      setLlmModel: (llmModel) => set({ llmModel }),
    }),
    {
      name: 'super-studio-settings',
      version: 1,
      migrate: (persistedState: unknown) => {
        const s = persistedState as { comfyuiHost?: string; llmModel?: string };
        const migrated: unknown = { ...(s as object) };
        if ((s as { comfyuiHost?: string })?.comfyuiHost === 'http://127.0.0.1:8188') {
          (migrated as { comfyuiHost?: string }).comfyuiHost = getDefaultHost();
        }
        if ((s as { llmModel?: string })?.llmModel === 'qwen3-vl:8b') {
          (migrated as { llmModel?: string }).llmModel = DEFAULT_LLM_MODEL;
        }
        return migrated;
      },
      partialize: (s) => ({
        comfyuiHost: s.comfyuiHost,
        theme: s.theme,
        currentMode: s.currentMode,
        llmBaseUrl: s.llmBaseUrl,
        llmApiKey: s.llmApiKey,
        llmModel: s.llmModel,
      }),
    }
  )
);

export { getItem, setItem };
