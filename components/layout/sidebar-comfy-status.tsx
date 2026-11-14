'use client';

import { useEffect, useState } from 'react';
import { Activity, Cpu, MemoryStick, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { comfyuiClient } from '@/lib/comfyui-client';
import { useComfyUI } from '@/hooks/use-comfyui';
import { useSettingsStore } from '@/stores/settings-store';
import { getWebSocketManager } from '@/lib/websocket-manager';
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
  // zustand persist 的 comfyuiHost 來自 localStorage，僅在 client 端取得；
  // SSR 會渲染預設值而與 client 首次渲染不一致 → hydration mismatch。
  // 故 mount 前渲染佔位符，保證伺服器與 client 首次渲染相同。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // GPU 執行狀態：ComfyUI API 不提供 GPU 計算使用率，
  // 以 WebSocket 執行事件推導「執行中（忙碌）/ 閒置」。
  const [gpuBusy, setGpuBusy] = useState(false);
  useEffect(() => {
    const unsub = getWebSocketManager().onEvent((event) => {
      switch (event.type) {
        case 'execution_start':
        case 'progress':
          setGpuBusy(true);
          break;
        case 'executing':
          // node === null 代表該 prompt 執行完畢
          setGpuBusy((event.data as { node?: unknown }).node != null);
          break;
        case 'execution_success':
        case 'execution_error':
        case 'execution_interrupted':
          setGpuBusy(false);
          break;
      }
    });
    return unsub;
  }, []);

  // 連線後抓取 system_stats 並持續輪詢：閒置 5 秒、GPU 執行中 2 秒；
  // gpuBusy 切換時依賴變動重跑 effect，即時刷新一次（執行開始／結束瞬間的 VRAM 變化）。
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
    const timer = setInterval(fetchStats, gpuBusy ? 2_000 : 5_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isConnected, host, authHeader, gpuBusy]);

  const device = stats?.devices?.[0];
  const vramTotal = device?.vram_total || 0;
  const vramFree = device?.vram_free || 0;
  const vramUsed = vramTotal - vramFree;
  const vramPct = vramTotal > 0 ? Math.round((vramUsed / vramTotal) * 100) : 0;
  // 系統 RAM（ComfyUI ≥ 0.3x 的 system_stats 才有）
  const ramTotal = stats?.system?.ram_total || 0;
  const ramFree = stats?.system?.ram_free ?? -1;
  const ramKnown = ramTotal > 0 && ramFree >= 0;
  const ramUsed = ramKnown ? ramTotal - ramFree : 0;
  const ramPct = ramKnown ? Math.round((ramUsed / ramTotal) * 100) : 0;
  const hostDisplay = mounted
    ? host
      ? host.replace(/^https?:\/\//, '')
      : '未設定'
    : '';

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
          <div
            className="mt-1.5 flex items-center gap-2 text-muted-foreground"
            title="ComfyUI API 不提供 GPU 計算使用率，此為執行狀態（生成中＝忙碌）"
          >
            <Activity className={cn('h-3.5 w-3.5 shrink-0', gpuBusy && 'animate-pulse text-success')} />
            <span className="truncate">GPU 使用率</span>
            <span
              className={cn(
                'ml-auto shrink-0 font-mono',
                gpuBusy ? 'text-success' : 'text-muted-foreground'
              )}
            >
              {gpuBusy ? '執行中' : '閒置'}
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
          {ramKnown && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MemoryStick className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  RAM：{formatGB(ramFree)} 可用 / {formatGB(ramTotal)}
                </span>
                <span className="ml-auto shrink-0 font-mono">{ramPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${ramPct}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
