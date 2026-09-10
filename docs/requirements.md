# Super Studio — Requirements Document

## 1. 專案概述

**Super Studio** 是一個基於 Next.js 的前端 Web 應用，連接本機運行的 ComfyUI 作為後端，提供直觀的圖形界面進行 AI 圖片和影片生成。

### 目標用戶
- 使用本機 ComfyUI 進行創作的個人用戶
- 需要一個比 ComfyUI 原生前端更友好的操作界面

### 核心價值
- 將 ComfyUI 的強大能力包裝為簡單易用的 UI
- 支持多種生成模式：文生圖、圖生圖、文生視頻、圖生視頻
- 提供即時生成進度反饋
- 支持任務排隊與批次管理
- 用戶可自定義 ComfyUI 連接地址
- 搭配 LLM（OpenAI 相容 API）優化提示詞／反推圖片
- 支持上傳和使用自定義工作流

### 已知 ComfyUI 環境
| 組件 | 詳情 |
|------|------|
| ComfyUI 版本 | 0.34.0 |
| 圖片模型 | Z-Image-Turbo (`z_image_turbo_bf16.safetensors`) |
| 視頻模型 | MiniMax H3 (`minimax_h3_fl2va_pruned_int8_convrot.safetensors`) + 音頻 |
| 文本編碼器 | Qwen 3 4B (圖片)、Qwen3VL 32B (視頻) |
| VAE | `ae.safetensors` (圖片)、`minimax_h3_video_vae_fp16` + `minimax_h3_audio_vae_fp32` (視頻) |
| 圖片放大 | RealESRGAN x4plus (`RealESRGAN_x4plus.safetensors`) |
| 影片放大 | SeedVR2 (`seedvr2_3b_int8_convrot.safetensors`) + `seedvr2_ema_vae_fp16.safetensors` |
| 自定義節點 | ComfyUI-Manager, ComfyUI-DMXAPI |
| 預設工作流 | 90+ 藍圖 JSON (ComfyUI blueprints 目錄) |

---

## 2. 用戶故事與驗收標準

### US-01: 配置 ComfyUI 連接

**作為**一個用戶，**我想要**在設定頁面配置 ComfyUI 伺服器地址，**以便**我可以連接到我的本機 ComfyUI 實例。

**驗收標準：**

```gherkin
Given 用戶在設定頁面
When 用戶輸入 ComfyUI 伺服器地址（如 http://127.0.0.1:8188）並點擊「測試連接」
Then 應用應向 ComfyUI 的 /system_stats 端點發送請求
And 顯示連接成功狀態和伺服器信息（版本、設備、VRAM）
And 將地址保存到 localStorage

Given 用戶已配置 ComfyUI 地址
When 應用啟動或頁面刷新
Then 應用應自動讀取保存的地址並嘗試連接
And 在頂部導航欄顯示連接狀態指示器（綠色=已連接，紅色=未連接）

Given ComfyUI 伺服器無法連接
When 用戶嘗試使用任何生成功能
Then 應顯示友好的錯誤提示，引導用戶檢查 ComfyUI 是否運行
```

---

### US-02: 文生圖（Text-to-Image）

**作為**一個用戶，**我想要**輸入文字提示詞並生成一張圖片，**以便**我可以快速將想法轉化為視覺內容。

**驗收標準：**

```gherkin
Given 用戶在文生圖模式下
When 用戶輸入提示詞 "a beautiful sunset over the ocean" 並點擊「生成」
Then 應用應提交 Z-Image-Turbo 工作流到 ComfyUI
And 顯示即時進度條（基於 WebSocket 的 progress 事件）
And 生成完成後在畫廊區域顯示結果圖片

Given 用戶在文生圖模式下
When 用戶修改參數（steps、CFG、寬度、高度、seed）並點擊「生成」
Then 應用應使用更新後的參數提交工作流
And 生成的圖片應反映新的參數設置

Given 用戶在文生圖模式下
When 用戶點擊「隨機 Seed」按鈕（🎲）
Then 應生成一個新的隨機 seed 值並顯示在 seed 輸入框中

Given 圖片生成正在進行中
When 用戶點擊「中斷」按鈕
Then 應用應向 ComfyUI 發送 /interrupt 請求
And 停止當前生成任務
```

---

### US-03: 圖生圖（Image-to-Image）

**作為**一個用戶，**我想要**上傳一張參考圖並結合提示詞生成新圖片，**以便**我可以基於現有圖片進行風格轉換或細節調整。

**驗收標準：**

```gherkin
Given 用戶在圖生圖模式下
When 用戶上傳一張圖片並輸入提示詞 "oil painting style" 
Then 應用應將圖片上傳到 ComfyUI 的 /upload/image 端點
And 使用圖片作為參考提交圖生圖工作流
And 顯示生成進度和結果

Given 用戶在圖生圖模式下
When 用戶上傳圖片後調整 denoise 強度滑塊
Then denoise 值應實時更新顯示
And 提交工作流時應使用調整後的 denoise 值

Given 用戶上傳的圖片格式不支持
When 用戶嘗試上傳非 PNG/JPG/WEBP 格式的文件
Then 應顯示錯誤提示，說明支持的圖片格式
```

---

### US-04: 文生視頻（Text-to-Video）

**作為**一個用戶，**我想要**輸入文字描述並生成一段影片，**以便**我可以快速製作動態視覺內容。

**驗收標準：**

```gherkin
Given 用戶在文生視頻模式下
When 用戶輸入提示詞 "a cat walking on the beach" 並設置時長為 5 秒
Then 應用應提交 MiniMax H3 文生視頻工作流到 ComfyUI
And 顯示生成進度（基於 WebSocket 事件）
And 生成完成後在畫廊顯示視頻預覽

Given 用戶在文生視頻模式下
When 用戶修改視頻參數（寬度、高度、時長、fps、seed）
Then 應用應使用更新後的參數提交工作流

Given 視頻生成完成
When 用戶點擊畫廊中的視頻卡片
Then 應顯示視頻播放器，支持播放、暫停、拖動進度條
And 顯示視頻的基本信息（時長、分辨率、文件大小）
```

---

### US-05: 圖生視頻（Image-to-Video）

**作為**一個用戶，**我想要**上傳一張圖片作為起始幀並生成影片，**以便**我可以將靜態圖片轉化為動態視頻。

**驗收標準：**

```gherkin
Given 用戶在圖生視頻模式下
When 用戶上傳一張首幀圖片並輸入提示詞描述動態效果
Then 應用應將圖片上傳到 ComfyUI
And 使用圖片作為 first_frame 提交 MiniMax H3 圖生視頻工作流
And 顯示生成進度

Given 用戶在圖生視頻模式下
When 用戶選擇上傳首幀圖片和尾幀圖片
Then 應用應同時使用兩張圖片作為 first_frame 和 last_frame
And 生成的視頻應在兩張圖片之間進行插值過渡

Given 用戶在圖生視頻模式下
When 用戶設置 turbo 模式為開啟
Then 應使用 LoRA 加速模型（6-8 步）而非標準模型（20 步）
And 生成速度應明顯加快
```

---

### US-06: 自定義工作流

**作為**一個高級用戶，**我想要**上傳自定義的 ComfyUI 工作流 JSON 文件，**以便**我可以使用 ComfyUI 的全部功能而不受預設模板限制。

**驗收標準：**

```gherkin
Given 用戶在自定義工作流模式下
When 用戶上傳一個 ComfyUI 工作流 JSON 文件
Then 應用應解析工作流結構
And 識別可配置的輸入節點（STRING、INT、FLOAT、BOOLEAN 類型）
And 動態生成對應的 UI 控制項

Given 用戶加載了自定義工作流
When 用戶修改動態生成的控制項值
Then 對應的節點輸入值應在工作流 JSON 中更新
And 提交的工作流應包含修改後的值

Given 用戶加載了自定義工作流
When 用戶點擊「導出工作流」
Then 應用應下載當前工作流的 JSON 文件
```

---

### US-07: 歷史記錄

**作為**一個用戶，**我想要**查看和管理之前的生成記錄，**以便**我可以回顧之前的作品並重複使用相同的參數。

**驗收標準：**

```gherkin
Given 用戶完成了多次生成任務
When 用戶導航到歷史記錄頁面
Then 應顯示按時間倒序排列的生成記錄列表
And 每條記錄應包含：縮略圖、提示詞摘要、生成模式、時間戳

Given 用戶在歷史記錄頁面
When 用戶點擊某條記錄的「重新加載參數」
Then 應用應將該記錄的參數（提示詞、seed、steps 等）加載到工作台
And 切換到對應的生成模式

Given 用戶在歷史記錄頁面
When 用戶選擇多條記錄並點擊「刪除」
Then 選中的記錄應從 localStorage 中移除
And 列表應立即更新
```

---

### US-08: 即時進度與預覽

**作為**一個用戶，**我想要**在生成過程中看到即時進度和預覽，**以便**我了解生成狀態並及時發現問題。

**驗收標準：**

```gherkin
Given 用戶提交了一個生成任務
When WebSocket 連接收到 progress 事件
Then 應顯示進度條和當前步驟信息（如 "Sampling: 5/20"）

Given 用戶提交了一個生成任務
When WebSocket 連接收到 executing 事件（包含節點 ID）
Then 應在進度面板顯示當前正在執行的節點名稱

Given 用戶提交了一個生成任務
When WebSocket 連接收到執行錯誤事件
Then 應顯示錯誤信息和出錯的節點信息
And 應保持進度條在錯誤狀態

Given 用戶提交了一個生成任務
When WebSocket 連接收到 binary 消息（預覽圖片）
Then 應在進度區域顯示即時預覽縮略圖
```

---

### US-09: 圖片放大（Image Upscale）

**作為**一個用戶，**我想要**將生成的圖片進行放大（提升解析度），**以便**我可以獲得高解析度的清晰圖片，適合列印或專業用途。

**驗收標準：**

```gherkin
Given 用戶在畫廊中有一張生成的圖片
When 用戶點擊圖片的「放大」操作
Then 應使用 RealESRGAN 放大工作流提交到 ComfyUI
And 顯示縮放倍數選項（如 2x、4x）
And 顯示生成進度

Given 用戶在畫廊中選擇了一張圖片並發起放大
When 放大完成
Then 應在畫廊中顯示放大後的結果
And 應顯示放大前後的解析度對比信息

Given 用戶對一張已放大的圖片再次執行放大
When 用戶點擊「放大」
Then 應用應允許在當前解析度基礎上繼續放大
And 應提示用戶當前圖片已經是放大版本
```

---

### US-10: 影片放大（Video Upscale）

**作為**一個用戶，**我想要**將生成的影片進行放大（提升解析度與畫質），**以便**我可以獲得更高清流暢的影片輸出。

**驗收標準：**

```gherkin
Given 用戶在畫廊中有一段生成的影片
When 用戶點擊影片的「放大」操作
Then 應使用 SeedVR2 影片放大工作流（`seedvr2_3b_int8_convrot.safetensors`）提交到 ComfyUI
And 顯示生成進度與預覽

Given 用戶在畫廊中選擇了一段影片並發起放大
When 放大完成
Then 應在畫廊中顯示放大後的影片（可播放）
And 應顯示放大前後的分辨率對比信息

Given 用戶對一段影片執行放大
When 放大過程中發生錯誤
Then 應顯示錯誤信息
And 原始影片應保持不變
```

---

## 3. 功能需求

### 3.1 生成模式

| 模式 | 工作流 | 核心參數 |
|------|--------|----------|
| 文生圖 | Z-Image-Turbo | prompt, width, height, seed, steps(8), unet_name, clip_name, vae_name |
| 圖生圖 | Z-Image-Turbo + LoadImage + denoise | prompt, image, denoise, width, height, seed |
| 文生視頻 | MiniMax H3 (prompt only) | prompt, width, height, duration, fps, noise_seed, unet_name, clip_name, vae_name, audio_vae, turbo_mode, lora_name |
| 圖生視頻 | MiniMax H3 (first_frame/last_frame) | prompt, first_frame, last_frame, width, height, duration, fps, noise_seed, turbo_mode, lora_name |
| 圖片放大 | RealESRGAN x4plus + 源圖片 | source_image, scale(2x/4x), upscale_model |
| 影片放大 | SeedVR2 + 源影片 | source_video, vae, 放大設定 |
| 自定義 | 用戶上傳 JSON | 動態解析 |

### 3.2 畫廊功能

- 圖片以網格形式展示，支持燈箱查看大圖
- 視頻以帶播放按鈕的卡片展示，支持內聯播放
- 支持下載單個文件
- 支持查看文件詳細信息（分辨率、文件大小、生成時間）
- 支持對圖片/影片執行「放大」（Upscale）操作
- 顯示放大前後的分辨率對比資訊
- 自動滾動到最新生成結果

### 3.3 工作流管理

- 預設工作流模板（基於用戶 ComfyUI 環境生成）
- 支持上傳自定義工作流 JSON
- 工作流中的可配置參數自動映射到 UI 控制項
- 支持導出當前工作流

### 3.4 設定管理

- ComfyUI 伺服器地址（可配置）
- 連接測試和狀態指示
- 系統信息顯示（ComfyUI 版本、GPU、VRAM 使用率）
- 主題切換（亮色/暗色）

---

## 4. 技術要求

### 4.1 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16+（本機 16.3.4） |
| 語言 | TypeScript | 5+ |
| 樣式 | Tailwind CSS | 3+（本機 3.4） |
| UI 組件 | shadcn/ui | latest |
| 狀態管理 | Zustand | 4+（本機 4.5） |
| 圖標 | lucide-react | latest |
| JSON 編輯 | @monaco-editor/react (可選) | latest |

### 4.2 架構要求

- **前端純 CSR 模式**：所有 ComfyUI 通訊通過 Next.js API Routes 代理（避免 CORS 問題）
- **WebSocket 連接**：直接從瀏覽器連接 ComfyUI WebSocket（ws://host/ws?clientId=xxx）
- **LLM 代理**：OpenAI 相容 API（Ollama 等）經 `/api/llm/*` 同源代理轉發，用於提示詞優化與圖片反推
- **類型安全**：所有 ComfyUI API 響應和工作流 JSON 使用 TypeScript 類型定義
- **錯誤處理**：網絡錯誤、ComfyUI 錯誤、工作流驗證錯誤均需友好提示
- **任務佇列**：多次生成以佇列管理（`stores/queue-store.ts` + `app/queue/`），可排序、中斷、載入參數

### 4.3 ComfyUI API 通訊

```
瀏覽器 --> Next.js API Route (/api/comfyui/*) --> ComfyUI 伺服器
瀏覽器 <-- WebSocket (ws://host/ws?clientId=xxx) <-- ComfyUI 伺服器
瀏覽器 --> Next.js API Route (/api/llm/*) --> OpenAI 相容 API (Ollama)
```

**代理端點：**
- `POST /api/comfyui/prompt` → `POST /prompt`
- `GET /api/comfyui/history/[promptId]` → `GET /history/{promptId}`
- `GET /api/comfyui/view` → `GET /view`
- `POST /api/comfyui/upload` → `POST /upload/image`
- `POST /api/comfyui/upload-video` → `POST /upload/video`
- `GET /api/comfyui/object_info` → `GET /object_info`
- `GET /api/comfyui/models/[folder]` → `GET /models/{folder}`
- `GET /api/comfyui/system_stats` → `GET /system_stats`
- `/api/llm/*` → 依 `X-LLM-BaseURL`/`X-LLM-Model`/`X-LLM-ApiKey` header 轉發至 OpenAI 相容 API

### 4.4 類型定義

```typescript
// types/comfyui.ts

interface ComfyUIServerInfo {
  system: { os: string; python_version: string; comfyui_version: string };
  devices: { vram_total: number; vram_free: number; torch_vram_total: number; torch_vram_free: number }[];
}

interface PromptRequest {
  prompt: Record<string, WorkflowNode>;
  client_id?: string;
  prompt_id?: string;
  front?: boolean;
}

interface WorkflowNode {
  class_type: string;
  inputs: Record<string, any>;
}

interface PromptResponse {
  prompt_id: string;
  number: number;
  node_errors: Record<string, any>;
}

interface HistoryEntry {
  [prompt_id: string]: {
    outputs: Record<string, { images?: FileInfo[]; gifs?: FileInfo[]; videos?: FileInfo[] }>;
    status: { status_str: string; completed: boolean };
    prompt: Record<string, WorkflowNode>;
  };
}

interface FileInfo {
  filename: string;
  subfolder: string;
  type: string;
}

// WebSocket events
type WSEventType = 'status' | 'execution_start' | 'execution_cached' | 'executing' | 'executed' | 'progress' | 'execution_success' | 'execution_error' | 'execution_interrupted';

interface WSEvent {
  type: WSEventType;
  data: Record<string, any>;
}
```

### 4.5 性能要求

- 頁面初始加載 < 2 秒
- WebSocket 連接建立 < 1 秒
- 生成提交響應 < 500ms
- 圖片預覽加載支持 lazy loading

---

## 5. 範例

### 5.1 文生圖工作流提交示例

```typescript
// Z-Image-Turbo workflow
const workflow = {
  "3": {
    class_type: "KSampler",
    inputs: {
      cfg: 1,
      denoise: 1,
      latent_image: ["13", 0],
      model: ["11", 0],
      negative: ["33", 0],
      positive: ["27", 0],
      sampler_name: "res_multistep",
      scheduler: "simple",
      seed: 12345,
      steps: 8
    }
  },
  "11": {
    class_type: "ModelSamplingAuraFlow",
    inputs: { model: ["28", 0], shift: 3 }
  },
  "13": {
    class_type: "EmptySD3LatentImage",
    inputs: { width: 1024, height: 1024, batch_size: 1 }
  },
  "27": {
    class_type: "CLIPTextEncode",
    inputs: { clip: ["30", 0], text: "a beautiful sunset" }
  },
  "28": {
    class_type: "UNETLoader",
    inputs: { unet_name: "z_image_turbo_bf16.safetensors", weight_dtype: "default" }
  },
  "29": {
    class_type: "VAELoader",
    inputs: { vae_name: "ae.safetensors" }
  },
  "30": {
    class_type: "CLIPLoader",
    inputs: { clip_name: "qwen_3_4b.safetensors", type: "lumina2" }
  },
  "33": {
    class_type: "ConditioningZeroOut",
    inputs: { conditioning: ["27", 0] }
  },
  "8": {
    class_type: "VAEDecode",
    inputs: { samples: ["3", 0], vae: ["29", 0] }
  },
  "9": {
    class_type: "SaveImage",
    inputs: { filename_prefix: "SuperStudio", images: ["8", 0] }
  }
};

// Submit
const response = await fetch('/api/comfyui/prompt', {
  method: 'POST',
  body: JSON.stringify({ prompt: workflow, client_id: wsClientId })
});
```

### 5.2 WebSocket 事件處理示例

```typescript
const ws = new WebSocket(`ws://${host}/ws?clientId=${clientId}`);

ws.onmessage = (event) => {
  if (typeof event.data === 'string') {
    const { type, data } = JSON.parse(event.data);
    switch (type) {
      case 'progress':
        updateProgress(data.value, data.max);
        break;
      case 'executing':
        if (data.node === null) generationComplete(data.prompt_id);
        else updateCurrentNode(data.node);
        break;
      case 'execution_error':
        showError(data.exception_message);
        break;
    }
  } else {
    // Binary message = preview image
    handlePreviewImage(event.data);
  }
};
```

### 5.3 圖片放大工作流示例（RealESRGAN）

```typescript
// Image Upscale (RealESRGAN x4plus)
const upscaleWorkflow = {
  "1": {
    class_type: "LoadImage",
    inputs: { image: "my_source_image.png" }
  },
  "2": {
    class_type: "ImageUpscaleWithModel",
    inputs: {
      upscale_model: ["3", 0],
      image: ["1", 0]
    }
  },
  "3": {
    class_type: "UpscaleModelLoader",
    inputs: { model_name: "RealESRGAN_x4plus.pth" }
  },
  "4": {
    class_type: "SaveImage",
    inputs: { filename_prefix: "SuperStudio-upscaled", images: ["2", 0] }
  }
};

// 若要放大 2x（而非模型預設的 4x），可額外加入縮放節點：
const upscale2xWorkflow = {
  ...upscaleWorkflow,
  "5": {
    class_type: "ImageScale",
    inputs: { image: ["2", 0], upscale_method: "lanczos", width: 1024, height: 1024, crop: "disabled" }
  }
};
```

---

## 6. 專案目錄結構

```
super_studio/
├── requirements.md                    # 本文件
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.js
├── components.json                    # shadcn/ui 配置
│
├── app/
│   ├── layout.tsx                     # 根佈局 + 主題 + 字體
│   ├── page.tsx                       # 首頁/工作台
│   ├── globals.css                    # 全局樣式 + CSS 變量
│   ├── settings/
│   │   └── page.tsx                   # 設定頁（ComfyUI + LLM + 主題）
│   ├── history/
│   │   └── page.tsx                   # 歷史記錄頁
│   ├── queue/
│   │   └── page.tsx                   # 生成佇列頁
│   └── api/
│       ├── comfyui/
│       │   ├── [...path]/route.ts     # 通用代理（forward all requests）
│       │   ├── upload/route.ts        # 圖片上傳代理
│       │   └── view/route.ts          # 文件查看代理
│       └── llm/
│           └── [...path]/route.ts     # OpenAI 相容 API 代理
│
├── components/
│   ├── ui/                            # shadcn/ui 組件（Button, Input, Card, etc.）
│   ├── layout/
│   │   ├── header.tsx                 # 頂部導航欄 + 連接狀態
│   │   └── sidebar.tsx                # 左側模式選擇
│   ├── workspace/
│   │   ├── workspace.tsx              # 工作台主容器
│   │   ├── right-panel.tsx            # 右欄參數面板容器
│   │   ├── prompt-panel.tsx           # 提示詞輸入（含 LLM 優化）
│   │   ├── parameter-controls.tsx     # 參數控制（steps, cfg, size, seed）
│   │   ├── model-selector.tsx         # 模型選擇下拉框
│   │   ├── image-upload.tsx           # 圖片上傳（圖生圖/圖生視頻用）
│   │   ├── generation-controls.tsx    # 生成/中斷按鈕 + 進度條
│   │   ├── video-controls.tsx         # 視頻特有參數（duration, fps, turbo）
│   │   ├── upscale-controls.tsx       # 放大參數（scale, upscale_model）
│   │   └── upscale-dialog.tsx         # 放大確認彈窗
│   ├── gallery/
│   │   ├── output-gallery.tsx         # 輸出結果網格
│   │   ├── media-card.tsx             # 單個媒體卡片（含放大操作）
│   │   ├── generating-card.tsx        # 生成中進度卡
│   │   ├── image-viewer.tsx           # 圖片燈箱
│   │   └── video-player.tsx           # 視頻播放器
│   ├── workflow/
│   │   ├── custom-workflow-panel.tsx  # 自定義工作流面板
│   │   ├── workflow-editor.tsx        # 自定義工作流 JSON 編輯器
│   │   ├── workflow-params.tsx        # 動態參數面板
│   │   └── workflow-upload.tsx        # 工作流上傳
│   └── settings/
│       ├── comfyui-config.tsx         # ComfyUI 連接設定表單
│       ├── llm-config.tsx             # LLM 服務設定表單
│       └── system-info.tsx            # 系統信息展示
│
├── hooks/
│   ├── use-comfyui.ts                 # ComfyUI 連接狀態 hook
│   ├── use-websocket.ts               # WebSocket 事件 hook
│   ├── use-generation.ts              # 生成任務管理 hook
│   ├── use-llm.ts                     # LLM 提示詞優化/反推 hook
│   └── use-toast.ts                   # Toast hook
│
├── lib/
│   ├── comfyui-client.ts              # ComfyUI API 客戶端
│   ├── websocket-manager.ts           # WebSocket 連接管理
│   ├── workflow-templates.ts          # 預設工作流模板生成
│   ├── workflow-parser.ts             # 工作流解析/參數提取
│   ├── modes.ts                       # 七種生成模式註冊
│   ├── llm-client.ts                  # OpenAI 相容 API 客戶端
│   ├── prompt-optimizer.ts            # 提示詞優化/圖片反推 prompt 構建
│   ├── drag-drop.ts                   # 拖放 helper
│   ├── storage.ts                     # localStorage 封裝
│   └── utils.ts                       # 通用工具函數
│
├── stores/
│   ├── settings-store.ts              # 設定 store（ComfyUI/LLM 地址、主題、模式）
│   ├── generation-store.ts            # 當前生成狀態 store
│   ├── queue-store.ts                 # 生成佇列 store
│   ├── history-store.ts               # 歷史記錄 store
│   └── gallery-store.ts               # 畫廊資料 store
│
├── types/
│   ├── comfyui.ts                     # ComfyUI API 類型定義
│   └── workflow.ts                    # 工作流相關類型
│
└── public/
    └── (靜態資源)
```

---

## 7. 開發階段

### Phase 1: 基礎框架
- 項目初始化 (Next.js + TS + Tailwind + shadcn/ui)
- ComfyUI 設定頁 + 連接測試
- API 代理層
- WebSocket 管理器
- 類型定義

### Phase 2: 文生圖
- Z-Image-Turbo 工作流模板
- 提示詞 + 參數控制 UI
- 生成進度 + 結果展示

### Phase 3: 圖生圖 + 視頻
- 圖片上傳組件
- 圖生圖工作流
- MiniMax H3 文生視頻工作流
- 圖生視頻工作流
- 視頻播放組件

### Phase 4: 圖片/影片放大
- RealESRGAN 圖片放大工作流（2x/4x）
- SeedVR2 影片放大工作流
- 畫廊放大操作（來源媒體選擇 + 縮放倍數）
- 放大前後分辨率對比

### Phase 5: 進階功能
- 自定義工作流上傳/解析
- 歷史記錄管理
- 主題切換
- 系統信息展示

### Phase 6: 佇列與 LLM 整合（已實作）
- 生成佇列（`/queue` 頁）：排隊、重新排序、中斷、載入參數
- LLM 提示詞優化：OpenAI 相容 API（Ollama）→ `/api/llm/*` 代理
- 圖片反推：以多模態 LLM 描述參考圖並回填提示詞
- 設定頁新增 LLM 區塊（Base URL / Model / API Key）
