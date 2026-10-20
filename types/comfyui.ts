export interface ComfyUISystemStats {
  system: {
    os: string;
    python_version: string;
    comfyui_version: string;
    args?: string[];
  };
  devices: Array<{
    name: string;
    type: string;
    index: number;
    vram_total: number;
    vram_free: number;
    torch_vram_total: number;
    torch_vram_free: number;
  }>;
}

export interface WorkflowNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: {
    title?: string;
    [key: string]: unknown;
  };
}

export interface PromptRequest {
  prompt: Record<string, WorkflowNode>;
  client_id?: string;
  prompt_id?: string;
  front?: boolean;
  extra_data?: Record<string, unknown>;
}

export interface PromptResponse {
  prompt_id: string;
  number: number;
  node_errors?: Record<string, { errors: Array<{ message: string; details: string }> }>;
}

export interface FileInfo {
  filename: string;
  subfolder: string;
  type: string;
}

export interface HistoryOutputImages {
  images?: FileInfo[];
  gifs?: FileInfo[];
  audio?: FileInfo[];
  '3d'?: FileInfo[];
  text?: string[];
}

export interface HistoryOutput {
  [nodeId: string]: HistoryOutputImages;
}

export interface HistoryEntry {
  [prompt_id: string]: {
    outputs: HistoryOutput;
    status: {
      status_str: string;
      completed: boolean;
      messages?: Array<[string, Record<string, unknown>]>;
    };
    prompt: Record<string, WorkflowNode>;
  };
}

export type WSEventType =
  | 'status'
  | 'execution_start'
  | 'execution_cached'
  | 'executing'
  | 'executed'
  | 'progress'
  | 'execution_success'
  | 'execution_error'
  | 'execution_interrupted';

export interface WSStatusData {
  status: {
    exec_info: {
      queue_remaining: number;
    };
  };
  sid?: string;
}

export interface WSExecutingData {
  node?: string | null;
  prompt_id?: string;
}

export interface WSProgressData {
  value: number;
  max: number;
  prompt_id?: string;
  node?: string | null;
}

export interface WSExecutionErrorData {
  prompt_id: string;
  node_type?: string;
  exception_message?: string;
  exception_type?: string;
  traceback?: string[];
}

export interface WSEvent<T = Record<string, unknown>> {
  type: WSEventType;
  data: T;
}

export interface ModelFolderItem {
  name: string;
}

export interface UploadResponse {
  name: string;
  subfolder: string;
  type: string;
}

export interface ErrorResult {
  code: string;
  message: string;
  nodeErrors?: Record<string, unknown>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ErrorResult };
