import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { useWebSocket } from '@/hooks/use-websocket';
import { comfyuiClient } from '@/lib/comfyui-client';
import { getWebSocketManager } from '@/lib/websocket-manager';
import type { ComfyUISystemStats } from '@/types/comfyui';
import type { WSConnectionStatus } from '@/lib/websocket-manager';

export function useComfyUI() {
  const { comfyuiHost, authHeader } = useSettingsStore();
  const ws = useWebSocket();
  const [wsStatus, setWsStatus] = useState<WSConnectionStatus>(ws.status);
  const [systemInfo, setSystemInfo] = useState<ComfyUISystemStats | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const isConnected = wsStatus === 'connected';

  const connect = useCallback(() => {
    const host = useSettingsStore.getState().comfyuiHost;
    if (host) {
      ws.connect(host);
      getWebSocketManager().connect(host);
    }
  }, [ws]);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    setWsStatus(getWebSocketManager().getStatus());
    const unsub = getWebSocketManager().onStatusChange(setWsStatus);
    return unsub;
  }, []);

  const testConnection = useCallback(async () => {
    const host = useSettingsStore.getState().comfyuiHost;
    setTesting(true);
    setTestError(null);
    const result = await comfyuiClient.testConnection(host, authHeader);
    setTesting(false);
    if (result.ok) {
      setSystemInfo(result.data);
      connect();
      return true;
    }
    setTestError(result.error.message);
    return false;
  }, [authHeader, connect]);

  useEffect(() => {
    if (wsStatus === 'connected' && !systemInfo) {
      const host = useSettingsStore.getState().comfyuiHost;
      comfyuiClient.testConnection(host, authHeader).then((r) => {
        if (r.ok) setSystemInfo(r.data);
      });
    }
  }, [wsStatus, systemInfo, authHeader]);

  return { isConnected, wsStatus, systemInfo, testing, testError, connect, testConnection };
}
