import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Mode } from '@/types/workflow';
import { getItem, setItem } from '@/lib/storage';

interface SettingsState {
  comfyuiHost: string;
  authHeader?: string;
  theme: 'light' | 'dark' | 'system';
  currentMode: Mode;
  setHost: (host: string) => void;
  setAuthHeader: (header?: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setMode: (mode: Mode) => void;
}

export const DEFAULT_HOST = 'http://127.0.0.1:8188';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      comfyuiHost: DEFAULT_HOST,
      theme: 'system',
      currentMode: 'text2img',
      setHost: (comfyuiHost) => set({ comfyuiHost }),
      setAuthHeader: (authHeader) => set({ authHeader }),
      setTheme: (theme) => set({ theme }),
      setMode: (currentMode) => set({ currentMode }),
    }),
    {
      name: 'super-studio-settings',
      partialize: (s) => ({
        comfyuiHost: s.comfyuiHost,
        theme: s.theme,
        currentMode: s.currentMode,
      }),
    }
  )
);

export { getItem, setItem };
