'use client';

import { Image as ImageIcon, Images, Clapperboard, Film, ZoomIn, ScanLine, Braces } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODES } from '@/lib/modes';
import { useSettingsStore } from '@/stores/settings-store';
import type { Mode } from '@/types/workflow';
import { useGenerationStore } from '@/stores/generation-store';

const ICONS: Record<Mode, React.ComponentType<{ className?: string }>> = {
  text2img: ImageIcon,
  img2img: Images,
  text2vid: Clapperboard,
  img2vid: Film,
  img_upscale: ZoomIn,
  vid_upscale: ScanLine,
  custom: Braces,
};

export function Sidebar() {
  const currentMode = useSettingsStore((s) => s.currentMode);
  const setMode = useSettingsStore((s) => s.setMode);
  const queueRemaining = useGenerationStore((s) => s.queueRemaining);

  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r md:flex">
      <nav className="flex-1 space-y-1 p-3">
        {MODES.map((mode) => {
          const Icon = ICONS[mode.id];
          const active = currentMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setMode(mode.id)}
              title={mode.description}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="border-t p-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>生成佇列</span>
          <span className="font-mono">{queueRemaining}</span>
        </div>
      </div>
    </aside>
  );
}
