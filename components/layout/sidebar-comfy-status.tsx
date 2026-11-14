'use client';

import { useEffect, useState } from 'react';
import { Cpu, MemoryStick, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { comfyuiClient } from '@/lib/comfyui-client';
import { useComfyUI } from '@/hooks/use-comfyui';
import { useSettingsStore } from '@/stores/settings-store';
import type { ComfyUISystemStats } from '@/types/comfyui';
import type { WSConnectionStatus } from '@/lib/websocket-manager';

const STATUS_LABEL: Record<WSConnectionStatus, string> = {
  connected: '已連接',
  connecting: '連線中',
  reconnecting: '重連中',
  disconnected: '未連接',
};

function formatGB(bytes: number): string {
  if (!bytes) return '0 GB';
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function SidebarComfyStatus() {
  const { wsStatus, isConnected } = useComfyUI();
  const host = useSettingsStore((s) => s.comfyuiHost);
  const authHeader = useSettingsStore((s) => s.authHeader);
  const [stats, setStats] = useState<ComfyUISystemStats | null>(null);

  // 連線後抓取 system_stats，並每 30 秒刷新（VRAM 用量）
  useEffect(() => {
    if (!isConnected) return;
    let alive = true;
    const fetchStats = () => {
      const { comfyuiHost, authHeader: auth } = useSettingsStore.getState();
      comfyuiClient.testConnection(comfyuiHost, auth).then((r) => {
        if (alive && r.ok) setStats(r.data);
      });
    };
    fetchStats();
    const timer = setInterval(fetchStats, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isConnected, host, authHeader]);

  const device = stats?.devices?.[0];
  const vramTotal = device?.vram_total || 0;
  const vramFree = device?.vram_free || 0;
  const vramUsed = vramTotal - vramFree;
  const vramPct = vramTotal > 0 ? Math.round((vramUsed / vramTotal) * 100) : 0;
  const hostDisplay = host ? host.replace(/^https?:\/\//, '') : '未設定';

  return (
    <div className="border-t px-3 py-3 text-xs">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            isConnected
              ? 'bg-success'
              : wsStatus === 'disconnected'
                ? 'bg-destructive'
                : 'bg-yellow-500 animate-pulse'
          )}
        />
        <span className={cn(isConnected ? 'text-foreground' : 'text-muted-foreground')}>
          ComfyUI {STATUS_LABEL[wsStatus]}
        </span>
        {stats?.system?.comfyui_version && (
          <span className="ml-auto truncate font-mono text-muted-foreground" title={stats.system.comfyui_version}>
            v{stats.system.comfyui_version}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-muted-foreground">
        <Server className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-mono" title={hostDisplay}>
          {hostDisplay}
        </span>
      </div>

      {device && (
        <>
          <div className="mt-1.5 flex items-center gap-2 text-muted-foreground">
            <Cpu className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate" title={`${device.name}（${device.type}）`}>
              {device.name}
            </span>
          </div>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MemoryStick className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                VRAM：{formatGB(vramFree)} 可用 / {formatGB(vramTotal)}
              </span>
              <span className="ml-auto shrink-0 font-mono">{vramPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${vramPct}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
