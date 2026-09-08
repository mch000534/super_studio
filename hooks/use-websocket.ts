'use client';

import { useEffect, useState } from 'react';
import { getWebSocketManager, type WSConnectionStatus } from '@/lib/websocket-manager';
import type { WSEvent } from '@/types/comfyui';

export function useWebSocket() {
  const manager = getWebSocketManager();
  const [status, setStatus] = useState<WSConnectionStatus>(manager.getStatus());

  useEffect(() => {
    const unsubStatus = manager.onStatusChange(setStatus);
    return unsubStatus;
  }, [manager]);

  return {
    status,
    clientId: manager.getClientId(),
    connect: (host: string) => manager.connect(host),
    disconnect: () => manager.disconnect(),
    onEvent: (cb: (event: WSEvent) => void) => manager.onEvent(cb),
    onPreview: (cb: (url: string) => void) => manager.onPreview(cb),
  };
}
