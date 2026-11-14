'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, Plug, Save, XCircle } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import { useComfyUI } from '@/hooks/use-comfyui';
import { SystemInfo } from '@/components/settings/system-info';
import { ResourceInspector } from '@/components/settings/resource-inspector';
import { toast } from '@/hooks/use-toast';

interface TestResult {
  ok: boolean;
  ms: number;
  host: string;
}

export function ComfyUIConfig() {
  const { comfyuiHost, setHost } = useSettingsStore();
  const { testConnection, testing, testError, systemInfo, isConnected } = useComfyUI();
  const [hostDraft, setHostDraft] = useState(comfyuiHost);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);

  const handleSave = () => {
    const h = hostDraft.trim().replace(/\/+$/, '');
    setHost(h);
    toast({ title: '已儲存', description: `ComfyUI 地址：${h || '未設定'}` });
  };

  const handleTest = async () => {
    const h = hostDraft.trim().replace(/\/+$/, '');
    setHost(h);
    setLastResult(null);
    const t0 = Date.now();
    const ok = await testConnection();
    const ms = Date.now() - t0;
    setLastResult({ ok, ms, host: h });
    if (ok) {
      toast({ title: '連接成功', description: 'ComfyUI 可正常連線' });
    } else {
      toast({
        variant: 'destructive',
        title: '連接失敗',
        description: '無法連接到 ComfyUI，請檢查地址與服務狀態',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>ComfyUI 伺服器地址</Label>
        <Input
          value={hostDraft}
          onChange={(e) => setHostDraft(e.target.value)}
          placeholder="http://127.0.0.1:8188"
        />
        <p className="text-xs text-muted-foreground">
          地址將保存在瀏覽器 localStorage，刷新後自動嘗試連接。
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} variant="outline">
          <Save className="mr-1 h-4 w-4" /> 儲存
        </Button>
        <Button onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
          測試連接
        </Button>
      </div>

      {lastResult && (
        <div className="flex items-center gap-2 text-sm">
          {lastResult.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          )}
          <span className={lastResult.ok ? 'text-success' : 'text-destructive'}>
            {lastResult.ok ? `連接成功（${lastResult.ms}ms）` : '連接失敗，請檢查地址與服務狀態'}
          </span>
          {lastResult.host && (
            <span className="truncate text-xs text-muted-foreground">{lastResult.host}</span>
          )}
        </div>
      )}

      {!lastResult && testError && <p className="text-sm text-destructive">{testError}</p>}
      {systemInfo && <SystemInfo info={systemInfo} />}
      <ResourceInspector isConnected={isConnected} />
    </div>
  );
}