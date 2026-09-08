'use client';

import { Cpu, MemoryStick, Monitor } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComfyUISystemStats } from '@/types/comfyui';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 GB';
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function SystemInfo({ info }: { info: ComfyUISystemStats }) {
  const device = info.devices?.[0];
  const vramTotal = device?.vram_total || 0;
  const vramFree = device?.vram_free || 0;
  const vramUsed = vramTotal - vramFree;
  const vramPct = vramTotal > 0 ? Math.round((vramUsed / vramTotal) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">系統資訊</CardTitle>
        <CardDescription>ComfyUI {info.system?.comfyui_version}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span>{info.system?.os}</span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span>{device?.name || '—'}（{device?.type || '—'}）</span>
        </div>
        <div className="flex items-center gap-2">
          <MemoryStick className="h-4 w-4 text-muted-foreground" />
          <span>
            VRAM：{formatBytes(vramFree)} 可用 / {formatBytes(vramTotal)}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">使用率 {vramPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${vramPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">Python {info.system?.python_version}</p>
      </CardContent>
    </Card>
  );
}