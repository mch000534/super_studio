'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Plug, Save } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import { useComfyUI } from '@/hooks/use-comfyui';
import { SystemInfo } from '@/components/settings/system-info';
import { toast } from '@/hooks/use-toast';

export function ComfyUIConfig() {
  const { comfyuiHost, setHost } = useSettingsStore();
  const { testConnection, testing, testError, systemInfo } = useComfyUI();
  const [hostDraft, setHostDraft] = useState(comfyuiHost);

  const handleSave = () => {
    const h = hostDraft.trim().replace(/\/+$/, '');
    setHost(h);
    toast({ title: '已儲存', description: `ComfyUI 地址：${h || '未設定'}` });
  };

  const handleTest = async () => {
    setHost(hostDraft.trim().replace(/\/+$/, ''));
    const ok = await testConnection();
    if (ok) {
      toast({ title: '連接成功', description: 'ComfyUI 可正常連線' });
    } else {
      toast({
        variant: 'destructive',
        title: '連接失敗',
        description: (systemInfo ? '' : '無法連接到') + ' ComfyUI，請檢查地址與服務狀態',
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

      {testError && <p className="text-sm text-destructive">{testError}</p>}
      {systemInfo && <SystemInfo info={systemInfo} />}
    </div>
  );
}