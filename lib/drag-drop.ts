import type { MediaItem } from '@/types/workflow';

export const GALLERY_ITEM_MIME = 'application/x-gallery-item';

export function setGalleryDragData(dt: DataTransfer, item: MediaItem) {
  dt.setData(GALLERY_ITEM_MIME, JSON.stringify(item));
  dt.effectAllowed = 'copy';
}

export function hasGalleryDragData(dt: DataTransfer): boolean {
  return Array.from(dt.types).includes(GALLERY_ITEM_MIME);
}

export function getGalleryDragItem(dt: DataTransfer): MediaItem | null {
  const raw = dt.getData(GALLERY_ITEM_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MediaItem;
  } catch {
    return null;
  }
}