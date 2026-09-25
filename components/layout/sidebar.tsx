'use client';

import Link from 'next/link';
import { Image as ImageIcon, Images, Wand2, Clapperboard, Film, ZoomIn, ScanLine, Braces, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODES } from '@/lib/modes';
import { useSettingsStore } from '@/stores/settings-store';
import type { Mode } from '@/types/workflow';
import { useQueueStore, queuePendingCount } from '@/stores/queue-store';

const ICONS: Record<Mode, React.ComponentType<{ className?: string }>> = {
  text2img: ImageIcon,
  img2img: Images,
  img_edit: Wand2,
  text2vid: Clapperboard,
  img2vid: Film,
  img_upscale: ZoomIn,
  vid_upscale: ScanLine,
  custom: Braces,
};

export function Sidebar() {
  const currentMode = useSettingsStore((s) => s.currentMode);
  const setMode = useSettingsStore((s) => s.setMode);
  const queueTasks = useQueueStore((s) => s.tasks);

  const pendingCount = queuePendingCount(queueTasks);

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
      <div className="border-t p-3">
        <Link
          href="/queue"
          className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <div className="flex items-center gap-2">
            <ListTodo className="h-3.5 w-3.5" />
            <span>生成佇列</span>
          </div>
          <span className="font-mono">{pendingCount}</span>
        </Link>
      </div>
    </aside>
  );
}
