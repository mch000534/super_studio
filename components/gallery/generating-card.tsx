'use client';

import { Loader2, Clock, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGenerationStore } from '@/stores/generation-store';
import { useQueueStore, type QueueTask } from '@/stores/queue-store';
import { getModeMeta } from '@/lib/modes';

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  queued: '佇列中',
  running: '生成中',
};

export function GeneratingCard({
  preview,
  onCancelTask,
}: {
  preview: string | null;
  onCancelTask?: (taskId: string) => void;
}) {
  const progressValue = useGenerationStore((s) => s.progressValue);
  const progressMax = useGenerationStore((s) => s.progressMax);
  const currentNode = useGenerationStore((s) => s.currentNode);
  const queueTasks = useQueueStore((s) => s.tasks);

  const activeTasks = queueTasks.filter(
    (t) => t.status === 'pending' || t.status === 'queued' || t.status === 'running'
  );

  if (activeTasks.length === 0) return null;

  const runningTask = activeTasks.find((t) => t.status === 'running');
  const pct = progressMax > 0 ? Math.round((progressValue / progressMax) * 100) : 0;

  return (
    <div className="space-y-2">
      {activeTasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          isCurrentRunning={task.id === runningTask?.id}
          preview={task.id === runningTask?.id ? preview : null}
          progressValue={task.id === runningTask?.id ? progressValue : 0}
          progressMax={task.id === runningTask?.id ? progressMax : 0}
          currentNode={task.id === runningTask?.id ? currentNode : ''}
          pct={task.id === runningTask?.id ? pct : 0}
          onCancel={onCancelTask}
        />
      ))}
    </div>
  );
}

function TaskCard({
  task,
  isCurrentRunning,
  preview,
  progressValue,
  progressMax,
  currentNode,
  pct,
  onCancel,
}: {
  task: QueueTask;
  isCurrentRunning: boolean;
  preview: string | null;
  progressValue: number;
  progressMax: number;
  currentNode: string;
  pct: number;
  onCancel?: (taskId: string) => void;
}) {
  const modeMeta = getModeMeta(task.params.mode);

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isCurrentRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {STATUS_LABELS[task.status] || task.status}
          </span>
          <Badge variant="secondary" className="text-xs">
            {modeMeta.label}
          </Badge>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onCancel(task.id)}
            title="取消任務"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {task.params.prompt && (
        <p className="mb-2 truncate text-xs text-muted-foreground">
          {task.params.prompt}
        </p>
      )}

      {isCurrentRunning && (
        <>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{currentNode || '處理中…'}</span>
            <span className="font-mono">{pct}%</span>
          </div>
          <Progress value={pct} className="mb-1" />
          {progressMax > 0 && (
            <p className="font-mono text-xs text-muted-foreground">
              {progressValue}/{progressMax} 步
            </p>
          )}
        </>
      )}

      {!isCurrentRunning && task.status === 'pending' && (
        <p className="text-xs text-muted-foreground">等待執行中…</p>
      )}

      {preview && isCurrentRunning && (
        <div className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="即時預覽"
            className="max-h-36 w-full rounded-md object-contain bg-secondary"
          />
        </div>
      )}
    </div>
  );
}
