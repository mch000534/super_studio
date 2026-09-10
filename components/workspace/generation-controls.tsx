'use client';

import { Loader2, Square, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useGenerationStore } from '@/stores/generation-store';
import { useQueueStore, queuePendingCount } from '@/stores/queue-store';
import { useComfyUI } from '@/hooks/use-comfyui';

interface GenerationControlsProps {
  onGenerate: () => void;
  onInterrupt: () => void;
  disabled?: boolean;
  label?: string;
  showProgress?: boolean;
}

export function GenerationControls({
  onGenerate,
  onInterrupt,
  disabled,
  label = '生成',
  showProgress = true,
}: GenerationControlsProps) {
  const { isConnected } = useComfyUI();
  const status = useGenerationStore((s) => s.status);
  const progressValue = useGenerationStore((s) => s.progressValue);
  const progressMax = useGenerationStore((s) => s.progressMax);
  const currentNode = useGenerationStore((s) => s.currentNode);
  const interrupting = useGenerationStore((s) => s.interruptRequested);
  const queueTasks = useQueueStore((s) => s.tasks);

  const pendingCount = queuePendingCount(queueTasks);
  const busy = status === 'queued' || status === 'running';
  const canGenerate = isConnected;
  const pct = progressMax > 0 ? Math.round((progressValue / progressMax) * 100) : 0;

  let buttonText = label;
  if (busy && pendingCount > 0) {
    buttonText = `加入佇列 (${pendingCount})`;
  } else if (busy) {
    buttonText = '生成中…';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={onGenerate}
          disabled={!canGenerate || disabled}
          className="flex-1"
          title={!isConnected ? '請先在設定中連接 ComfyUI' : undefined}
        >
          {busy ? (
            <>
              {pendingCount > 0 ? (
                <Plus className="mr-2 h-4 w-4" />
              ) : (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
            </>
          ) : (
            <span className="mr-2">✦</span>
          )}
          {buttonText}
        </Button>
        {busy && (
          <Button variant="destructive" size="icon" onClick={onInterrupt} disabled={interrupting}>
            {interrupting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {!isConnected && (
        <p className="text-xs text-destructive">ComfyUI 未連線 — 請前往設定頁配置後再生成。</p>
      )}

      {showProgress && (status === 'queued' || status === 'running') && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {currentNode ? `目前節點: ${currentNode}` : '佇列中…'}
            </span>
            <span className="font-mono">{pct}%</span>
          </div>
          <Progress value={pct} />
          {progressMax > 0 && (
            <p className="font-mono text-xs text-muted-foreground">
              {progressValue}/{progressMax} 步
            </p>
          )}
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-destructive">生成失敗 — 請查看錯誤訊息。</p>
      )}

      {pendingCount > 1 && (
        <p className="text-xs text-muted-foreground">
          佇列中還有 {pendingCount - 1} 個待處理任務
        </p>
      )}
    </div>
  );
}
