import type { WSEvent, WSEventType } from '@/types/comfyui';

export type WSConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type EventListener = (event: WSEvent) => void;
type PreviewListener = (blobUrl: string) => void;
type StatusListener = (status: WSConnectionStatus) => void;

const RECONNECT_MAX_DELAY = 30000;
const RECONNECT_BASE_DELAY = 1000;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private clientId: string;
  private host: string = '';
  private status: WSConnectionStatus = 'disconnected';
  private listeners = new Set<EventListener>();
  private previewListeners = new Set<PreviewListener>();
  private statusListeners = new Set<StatusListener>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private lastPreviewUrl: string | null = null;
  private expectedClose = false;

  constructor() {
    this.clientId = this.generateClientId();
  }

  private generateClientId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  getClientId(): string {
    return this.clientId;
  }

  getStatus(): WSConnectionStatus {
    return this.status;
  }

  connect(host: string): void {
    this.host = host.replace(/^http/, 'ws').replace(/\/$/, '');
    this.shouldReconnect = true;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.open();
  }

  private open(): void {
    if (!this.host) return;
    this.setStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    this.expectedClose = false;

    try {
      this.ws = new WebSocket(`${this.host}/ws?clientId=${this.clientId}`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('connected');
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === 'string') {
          const parsed = JSON.parse(event.data) as WSEvent;
          this.emit(parsed);
        } else {
          this.handleBinary(event.data as ArrayBuffer | Blob);
        }
      } catch {
        // malformed message, ignore
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.expectedClose && this.shouldReconnect) {
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected');
      }
    };

    this.ws.onerror = () => {
      // onclose will follow
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_DELAY
    );
    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempt += 1;
      this.open();
    }, delay);
  }

  private handleBinary(data: ArrayBuffer | Blob): void {
    const convertToArrayBuffer = (d: ArrayBuffer | Blob): Promise<ArrayBuffer> =>
      d instanceof Blob ? d.arrayBuffer() : Promise.resolve(d);

    convertToArrayBuffer(data).then((buffer) => {
      if (buffer.byteLength < 8) return;
      const header = new DataView(buffer);
      const eventType = header.getUint32(0);
      if (eventType !== 1) return;

      const imageBytes = new Uint8Array(buffer, 8);
      const blob = new Blob([imageBytes], {
        type: header.getUint32(4) === 1 ? 'image/jpeg' : 'image/png',
      });

      if (this.lastPreviewUrl) {
        URL.revokeObjectURL(this.lastPreviewUrl);
      }
      const url = URL.createObjectURL(blob);
      this.lastPreviewUrl = url;
      this.previewListeners.forEach((cb) => cb(url));
    });
  }

  private emit(event: WSEvent): void {
    this.listeners.forEach((cb) => cb(event));
  }

  onEvent(cb: EventListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onPreview(cb: PreviewListener): () => void {
    this.previewListeners.add(cb);
    return () => this.previewListeners.delete(cb);
  }

  onStatusChange(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  private setStatus(status: WSConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.expectedClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  destroy(): void {
    this.disconnect();
    this.listeners.clear();
    this.previewListeners.clear();
    this.statusListeners.clear();
  }

  static typedEvent<T>(type: WSEventType): (event: WSEvent) => T | null {
    return (event: WSEvent) => (event.type === type ? (event.data as T) : null);
  }
}

const manager = new WebSocketManager();

export function getWebSocketManager(): WebSocketManager {
  return manager;
}

export { WebSocketManager };
