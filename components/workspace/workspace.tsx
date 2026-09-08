'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { RightPanel } from '@/components/workspace/right-panel';
import { OutputGallery } from '@/components/gallery/output-gallery';
import { UpscaleDialog } from '@/components/workspace/upscale-dialog';
import type { MediaItem } from '@/types/workflow';

export function Workspace() {
  const [upscaleTarget, setUpscaleTarget] = useState<MediaItem | null>(null);

  const handleUpscale = (item: MediaItem) => {
    setUpscaleTarget(item);
  };

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <OutputGallery onUpscale={handleUpscale} />
        </main>
        <RightPanel />
      </div>

      <UpscaleDialog target={upscaleTarget} onClose={() => setUpscaleTarget(null)} />
    </div>
  );
}