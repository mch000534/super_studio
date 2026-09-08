'use client';

import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useGenerationStore } from '@/stores/generation-store';

export function GeneratingCard({
  preview,
}: {
  preview: string | null;
}) {
  const progressValue = useGenerationStore((s) => s.progressValue);
  const progressMax = useGenerationStore((s) => s.progressMax);
  const currentNode = useGenerationStore((s) => s.currentNode);
  const queueRemaining = useGenerationStore((s) => s.queueRemaining);
  const status = useGenerationStore((s) => s.status);

  const pct = progressMax > 0 ? Math.round((progressValue / progressMax) * 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">
            {status === 'queued' ? '佇列中…' : '生成中…'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">剩餘佇列: {queueRemaining}</span>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>目前節點: {currentNode || '—'}</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <Progress value={pct} className="mb-2" />
      {progressMax > 0 && (
        <p className="font-mono text-xs text-muted-foreground">
          {progressValue}/{progressMax} 步
        </p>
      )}

      {preview && (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="即時預覽"
            className="max-h-48 w-full rounded-md object-contain bg-secondary"
          />
        </div>
      )}
    </div>
  );
}