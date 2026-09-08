'use client';

import { useState } from 'react';
import { Images } from 'lucide-react';
import { MediaCard } from '@/components/gallery/media-card';
import { ImageViewer } from '@/components/gallery/image-viewer';
import { GeneratingCard } from '@/components/gallery/generating-card';
import { useGalleryStore } from '@/stores/gallery-store';
import { useGenerationStore } from '@/stores/generation-store';
import type { MediaItem } from '@/types/workflow';

interface OutputGalleryProps {
  onUpscale: (item: MediaItem) => void;
}

export function OutputGallery({ onUpscale }: OutputGalleryProps) {
  const items = useGalleryStore((s) => s.items);
  const status = useGenerationStore((s) => s.status);
  const preview = useGenerationStore((s) => s.preview);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const generating = status === 'queued' || status === 'running';

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4">
      <div className="space-y-4">
        {generating && <GeneratingCard preview={preview} />}

        {items.length === 0 && !generating ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Images className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">尚無生成結果</p>
              <p className="mt-1 text-sm text-muted-foreground">在右側輸入提示詞開始你的創作</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <MediaCard
                key={item.url}
                item={item}
                onOpen={(m) => setViewerIndex(items.findIndex((x) => x.url === m.url))}
                onUpscale={onUpscale}
              />
            ))}
          </div>
        )}
      </div>

      {viewerIndex !== null && (
        <ImageViewer
          items={items}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      )}
    </div>
  );
}