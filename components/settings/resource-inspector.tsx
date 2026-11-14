'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Loader2,
  PackageSearch,
  RefreshCw,
  Workflow,
} from 'lucide-react';
import { comfyuiClient } from '@/lib/comfyui-client';
import { useSettingsStore } from '@/stores/settings-store';

const MODEL_FOLDERS = [
  { folder: 'checkpoints', label: 'Checkpoint 主模型' },
  { folder: 'diffusion_models', label: 'Diffusion 模型（UNET）' },
  { folder: 'text_encoders', label: '文字編碼器（CLIP / Text Encoder）' },
  { folder: 'vae', label: 'VAE' },
  { folder: 'loras', label: 'LoRA' },
  { folder: 'clip_vision', label: 'CLIP Vision' },
  { folder: 'upscale_models', label: '放大模型（Upscale）' },
  { folder: 'audio_encoders', label: '音訊編碼器（Audio Encoder）' },
] as const;

interface FolderResult {
  folder: string;
  label: string;
  items: string[] | null; // null = 資料夾不存在或無法讀取
}

export function ResourceInspector({ isConnected }: { isConnected: boolean }) {
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<FolderResult[] | null>(null);
  const [workflows, setWorkflows] = useState<string[] | null>(null);
  const [workflowUnsupported, setWorkflowUnsupported] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const check = useCallback(async () => {
    const { comfyuiHost: host, authHeader } = useSettingsStore.getState();
    if (!host) return;
    setLoading(true);
    const results = await Promise.all(
      MODEL_FOLDERS.map(async (f): Promise<FolderResult> => {
        const r = await comfyuiClient.listModels(f.folder, host, authHeader);
        return {
          folder: f.folder,
          label: f.label,
          items: r.ok ? r.data.map((m) => m.name).sort() : null,
        };
      })
    );
    setFolders(results);
    const wf = await comfyuiClient.listUserWorkflows(host, authHeader);
    setWorkflows(wf.ok ? wf.data.sort() : null);
    setWorkflowUnsupported(!wf.ok);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isConnected && !folders && !loading) check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const workflowCount = workflows?.length ?? 0;

  const renderList = (items: string[], emptyText: string) => (
    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md bg-secondary/40 p-2 text-xs">
      {items.length === 0 ? (
        <li className="text-muted-foreground">{emptyText}</li>
      ) : (
        items.map((name) => (
          <li key={name} className="truncate font-mono" title={name}>
            {name}
          </li>
        ))
      )}
    </ul>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">可用資源檢查</CardTitle>
          <CardDescription>檢查 ComfyUI 上可用的模型與已儲存工作流</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={check} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : folders ? (
            <RefreshCw className="mr-1 h-4 w-4" />
          ) : (
            <PackageSearch className="mr-1 h-4 w-4" />
          )}
          {folders ? '重新檢查' : '檢查'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {!folders && !loading && (
          <p className="text-sm text-muted-foreground">
            連接 ComfyUI 後自動檢查，或點擊「檢查」手動執行。
          </p>
        )}

        {folders?.map((f) => {
          const key = `folder:${f.folder}`;
          const isOpen = !!expanded[key];
          return (
            <div key={f.folder} className="space-y-1.5">
              <button
                type="button"
                onClick={() => toggle(key)}
                className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-secondary/60"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.label}</span>
                <span className="ml-auto shrink-0">
                  {f.items === null ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      不存在
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{f.items.length} 個</Badge>
                  )}
                </span>
              </button>
              {isOpen &&
                (f.items === null ? (
                  <p className="pl-10 text-xs text-muted-foreground">
                    此資料夾不存在或無法讀取
                  </p>
                ) : (
                  <div className="pl-6">{renderList(f.items, '尚無模型')}</div>
                ))}
            </div>
          );
        })}

        {folders && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => toggle('workflows')}
              className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-secondary/60"
            >
              {expanded['workflows'] ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">已儲存工作流（ComfyUI userdata）</span>
              <span className="ml-auto shrink-0">
                <Badge variant="secondary">{workflowCount} 個</Badge>
              </span>
            </button>
            {expanded['workflows'] &&
              (workflowUnsupported ? (
                <p className="pl-10 text-xs text-muted-foreground">
                  此 ComfyUI 版本不支援讀取已儲存工作流（版本過舊或未啟用使用者資料夾）
                </p>
              ) : (
                <div className="pl-6">
                  {renderList(
                    (workflows ?? []).map((p) => p.replace(/\.json$/i, '')),
                    '尚無已儲存工作流'
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
