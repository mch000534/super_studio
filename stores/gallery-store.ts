import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MediaItem } from '@/types/workflow';

interface GalleryState {
  items: MediaItem[];
  addItems: (items: MediaItem[]) => void;
  setItems: (items: MediaItem[]) => void;
  removeItem: (url: string) => void;
  removeItems: (urls: string[]) => void;
  clear: () => void;
}

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set) => ({
      items: [],
      addItems: (items) =>
        set((s) => {
          const existing = new Set(s.items.map((i) => i.url));
          const unique = items.filter((i) => !existing.has(i.url));
          return { items: [...unique, ...s.items].slice(0, 500) };
        }),
      removeItem: (url) => set((s) => ({ items: s.items.filter((i) => i.url !== url) })),
      setItems: (items) => set({ items }),
      removeItems: (urls) =>
        set((s) => {
          if (urls.length === 0) return s;
          const drop = new Set(urls);
          return { items: s.items.filter((i) => !drop.has(i.url)) };
        }),
      clear: () => set({ items: [] }),
    }),
    { name: 'super-studio-gallery' }
  )
);