import { create } from 'zustand';
import type { MediaItem } from '@/types/workflow';

interface GalleryState {
  items: MediaItem[];
  addItems: (items: MediaItem[]) => void;
  removeItem: (url: string) => void;
  clear: () => void;
}

export const useGalleryStore = create<GalleryState>((set) => ({
  items: [],
  addItems: (items) => set((s) => ({ items: [...items, ...s.items] })),
  removeItem: (url) => set((s) => ({ items: s.items.filter((i) => i.url !== url) })),
  clear: () => set({ items: [] }),
}));
