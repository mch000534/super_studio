'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Settings, History, Sparkles, Loader2, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useComfyUI } from '@/hooks/use-comfyui';
import { useQueueStore, queuePendingCount } from '@/stores/queue-store';

export function Header() {
  const { isConnected, wsStatus, testing } = useComfyUI();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const queueTasks = useQueueStore((s) => s.tasks);

  const pendingCount = queuePendingCount(queueTasks);

  useEffect(() => setMounted(true), []);

  const statusConfig = !isConnected
    ? { label: '未連線', dot: 'bg-destructive', text: 'text-destructive' }
    : wsStatus === 'connected'
      ? { label: '已連線', dot: 'bg-success', text: 'text-success' }
      : { label: '連線中', dot: 'bg-yellow-500', text: 'text-yellow-500' };

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold">Super Studio</span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm" title="ComfyUI 連線狀態">
          {testing ? (
            <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
          ) : (
            <span className={`h-2.5 w-2.5 rounded-full ${wsStatus === 'connected' ? 'bg-success' : statusConfig.dot}`} />
          )}
          <span className={statusConfig.text}>
            {testing ? '測試中' : statusConfig.label}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="主題">
              {mounted && theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="mr-2 h-4 w-4" /> 亮色
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="mr-2 h-4 w-4" /> 暗色
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="mr-2 h-4 w-4" /> 系統
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" asChild aria-label="佇列" className="relative">
          <Link href="/queue">
            <ListTodo className="h-4 w-4" />
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                {pendingCount}
              </span>
            )}
          </Link>
        </Button>

        <Button variant="ghost" size="icon" asChild aria-label="歷史">
          <Link href="/history">
            <History className="h-4 w-4" />
          </Link>
        </Button>

        <Button variant="ghost" size="icon" asChild aria-label="設定">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
