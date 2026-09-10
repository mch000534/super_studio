'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Eraser,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQueueStore, type QueueTask, type QueueTaskStatus } from '@/stores/queue-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useGenerationStore } from '@/stores/generation-store';
import { useGeneration } from '@/hooks/use-generation';
import { getModeMeta } from '@/lib/modes';
import { toast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<
  QueueTaskStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: '等待中', icon: Clock, variant: 'secondary' },
  queued: { label: '佇列中', icon: Loader2, variant: 'secondary' },
  running: { label: '生成中', icon: Loader2, variant: 'default' },
  completed: { label: '已完成', icon: CheckCircle2, variant: 'outline' },
  failed: { label: '失敗', icon: XCircle, variant: 'destructive' },
  cancelled: { label: '已取消', icon: Ban, variant: 'secondary' },
};

export default function QueuePage() {
  const tasks = useQueueStore((s) => s.tasks);
  const moveTask = useQueueStore((s) => s.moveTask);
  const removeTask = useQueueStore((s) => s.removeTask);
  const removeTasks = useQueueStore((s) => s.removeTasks);
  const clearCompleted = useQueueStore((s) => s.clearCompleted);
  const setMode = useSettingsStore((s) => s.setMode);
  const router = useRouter();
  const { cancelTask } = useGeneration();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(
    () => [...tasks].sort((a, b) => a.createdAt - b.createdAt),
    [tasks]
  );

  const activeTasks = useMemo(
    () => sorted.filter((t) => t.status === 'pending' || t.status === 'queued' || t.status === 'running'),
    [sorted]
  );

  const completedTasks = useMemo(
    () =>
      sorted.filter(
        (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
      ),
    [sorted]
  );

  const allSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      sorted.forEach((r) => {
        if (allSelected) next.delete(r.id);
        else next.add(r.id);
      });
      return next;
    });
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = () => {
    if (selected.size === 0) return;
    // Cancel any running/queued tasks in selection
    for (const id of selected) {
      const task = tasks.find((t) => t.id === id);
      if (task && (task.status === 'running' || task.status === 'queued')) {
        cancelTask(id);
      }
    }
    removeTasks(Array.from(selected));
    setSelected(new Set());
    toast({ title: '已刪除', description: `移除了 ${selected.size} 個任務` });
  };

  const handleReload = (task: QueueTask) => {
    setMode(task.params.mode);
    useGenerationStore.getState().setParams({ ...task.params, mode: task.params.mode });
    toast({
      title: '已載入參數',
      description: `${getModeMeta(task.params.mode).label} 模式參數已套用`,
    });
    router.replace('/');
  };

  const handleClearCompleted = () => {
    const count = completedTasks.length;
    if (count === 0) return;
    clearCompleted();
    toast({ title: '已清除', description: `移除了 ${count} 個已完成任務` });
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">生成佇列</h1>
          <Badge variant="secondary">{sorted.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Badge variant="secondary">已選 {selected.size} 筆</Badge>
          )}
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              ref={selectAllRef}
              checked={allSelected}
              onChange={toggleAll}
              disabled={sorted.length === 0}
              suppressHydrationWarning
              className="h-4 w-4"
            />
            全選
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCompleted}
            disabled={completedTasks.length === 0}
          >
            <Eraser className="mr-1 h-4 w-4" /> 清除已完成
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={selected.size === 0}
          >
            <Trash2 className="mr-1 h-4 w-4" /> 刪除
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          <p>尚無排隊任務</p>
          <p className="mt-1 text-sm">在工作台中點擊生成後，任務會出現在這裡</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTasks.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                進行中 ({activeTasks.length})
              </h2>
              <ul className="space-y-2">
                {activeTasks.map((task) => (
                  <QueueTaskRow
                    key={task.id}
                    task={task}
                    selected={selected.has(task.id)}
                    onToggle={() => toggle(task.id)}
                    onDelete={() => {
                      if (task.status === 'running' || task.status === 'queued') {
                        cancelTask(task.id);
                      }
                      removeTask(task.id);
                      setSelected((prev) => {
                        const next = new Set(prev);
                        next.delete(task.id);
                        return next;
                      });
                    }}
                    onReload={() => handleReload(task)}
                    onMoveUp={() => moveTask(task.id, 'up')}
                    onMoveDown={() => moveTask(task.id, 'down')}
                    isFirst={sorted.indexOf(task) === 0}
                    isLast={sorted.indexOf(task) === sorted.length - 1}
                  />
                ))}
              </ul>
            </section>
          )}

          {completedTasks.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                已完成 ({completedTasks.length})
              </h2>
              <ul className="space-y-2">
                {completedTasks.map((task) => (
                  <QueueTaskRow
                    key={task.id}
                    task={task}
                    selected={selected.has(task.id)}
                    onToggle={() => toggle(task.id)}
                    onDelete={() => {
                      removeTask(task.id);
                      setSelected((prev) => {
                        const next = new Set(prev);
                        next.delete(task.id);
                        return next;
                      });
                    }}
                    onReload={() => handleReload(task)}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function QueueTaskRow({
  task,
  selected,
  onToggle,
  onDelete,
  onReload,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  task: QueueTask;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onReload: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const config = STATUS_CONFIG[task.status];
  const Icon = config.icon;
  const modeMeta = getModeMeta(task.params.mode);
  const pct =
    task.progressMax > 0 ? Math.round((task.progressValue / task.progressMax) * 100) : 0;

  const canReorder = task.status === 'pending' && onMoveUp && onMoveDown;

  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        suppressHydrationWarning
        className="h-4 w-4"
      />

      {canReorder && (
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onMoveUp}
            disabled={isFirst}
            title="上移"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onMoveDown}
            disabled={isLast}
            title="下移"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={config.variant} className="shrink-0">
            <Icon
              className={`mr-1 h-3 w-3 ${task.status === 'running' || task.status === 'queued' ? 'animate-spin' : ''}`}
            />
            {config.label}
          </Badge>
          <Badge variant="secondary" className="shrink-0">
            {modeMeta.label}
          </Badge>
          <span className="truncate text-sm font-medium">
            {task.params.prompt || modeMeta.label}
          </span>
        </div>

        {(task.status === 'running' || task.status === 'queued') && task.progressMax > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{task.currentNode || '處理中…'}</span>
              <span className="font-mono">{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        )}

        {task.status === 'running' && !task.progressMax && (
          <p className="mt-1 text-xs text-muted-foreground">
            {task.currentNode || '執行中…'}
          </p>
        )}

        {task.error && (
          <p className="mt-1 text-xs text-destructive">{task.error}</p>
        )}

        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(task.createdAt).toLocaleString('zh-Hant')}
        </p>
      </div>

      <Button variant="ghost" size="sm" onClick={onReload} title="載入參數">
        <RotateCcw className="mr-1 h-3.5 w-3.5" /> 載入
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} title="刪除任務">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}
