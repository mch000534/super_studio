# Super Studio

一個基於 **Next.js 16 + TypeScript + Tailwind CSS** 的 ComfyUI 前端工作台，將本機 ComfyUI 封裝為直觀的圖形界面，支援文生圖、圖生圖、文生影片、圖生影片、圖片/影片放大與自定義工作流。

## 功能

- **七種生成模式**：文生圖、圖生圖、文生影片、圖生影片、圖片放大、影片放大、自定義工作流
- **即時進度回饋**：透過 WebSocket 顯示節點執行進度與即時預覽圖
- **生成佇列**：批次排隊、重新排序、中斷與載入前一任務參數（`/queue` 頁）
- **LLM 提示詞優化**：接 OpenAI 相容 API（Ollama 等），將口語描述擴充為高品質英文提示詞、或反推參考圖內容（`反推圖片並優化`）
- **可設定 ComfyUI 地址**：在設定頁配置與測試連線，支援跨主機代理
- **畫廊與歷史**：生成結果集中管理，可下載、檢視、再次放大
- **深色/淺色主題**與響應式版面（桌面三欄、平板抽屜、手機 Sheet）

## 技術架構

| 層級 | 說明 |
|------|------|
| 前端 | React 18 + Next.js 16 (App Router)、Zustand 狀態管理、shadcn/ui 風格元件 |
| 代理層 | `app/api/comfyui/[...path]/route.ts` 將瀏覽器請求轉發至 ComfyUI（避免 CORS） |
| LLM 代理 | `app/api/llm/[...path]/route.ts` 轉發 OpenAI 相容 API（提示詞優化／圖反推） |
| WebSocket | 瀏覽器經 `ws://<host>/ws?clientId=...` 直連，`websocket-manager` 負責重連與事件分發 |
| 工作流 | `lib/workflow-templates.ts` 依模式生成 API-format 工作流，已對照本機 ComfyUI v0.34 節點簽名驗證 |
| 佇列 | `stores/queue-store.ts` + `app/queue/` 管理多任務排隊、中斷與重載 |

主要資料夾：

```
app/            路由頁面（首頁 / settings / history / queue）與 API 代理
components/     UI 元件（workspace / gallery / workflow / settings / layout）
hooks/          生成、WebSocket、LLM、ComfyUI 連線 hooks
lib/            client、websocket、工作流模板與解析、LLM、拖放、儲存
stores/         Zustand store（settings / generation / queue / history / gallery）
types/          ComfyUI 與工作流程型別
docs/           需求、規格、UI/UX 與開發任務清單
```

## 前置需求

- **Node.js ≥ 20**（本機使用 v20.18.0，安裝於使用者空間）
  - 若 npx/npm 不在 PATH，請先：`export PATH="$HOME/.local/node/bin:$PATH"`
- **ComfyUI** 於 `127.0.0.1:8188` 執行（本機環境為 v0.34.0），並掛載下列模型：

| 用途 | 模型檔 |
|------|--------|
| 圖片 UNET | `z_image_turbo_bf16.safetensors` |
| 影片 UNET | `minimax_h3_fl2va_pruned_int8_convrot.safetensors` |
| 放大 UNET | `seedvr2_3b_int8_convrot.safetensors` |
| 圖片 VAE / CLIP | `ae.safetensors`、`qwen_3_4b.safetensors` |
| 影片 VAE | `minimax_h3_video_vae_fp16.safetensors`、`minimax_h3_audio_vae_fp32.safetensors` |
| 影片 CLIP | `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` |
| Turbo LoRA | `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` |
| 圖片放大模型 | `RealESRGAN_x4plus.safetensors` |
| 影片放大 VAE | `seedvr2_ema_vae_fp16.safetensors` |

## 安裝與執行

```bash
npm install
npm run dev          # 開發模式（預設 http://localhost:3000）
```

先在本機 ComfyUI 上傳測試素材，再到設定頁填入 ComfyUI 地址：
- 直接連線： `http://127.0.0.1:8188`
- 跨主機連線：填遠端地址，並可視需要在 ComfyUI `extra_model_paths.yaml` 或 `config` 允許 CORS，或加自訂 header（`X-ComfyUI-Host` / `X-ComfyUI-Auth`）

> 代理設計：前端呼叫同源的 `/api/comfyui/*`，由 Next.js 依 `X-ComfyUI-Host`/`X-ComfyUI-Auth` header 轉發，因此瀏覽器不需直接暴露遠端地址。

### LLM 提示詞優化設定（選用）

提示詞面板的「優化提示詞／反推圖片並優化」按鈕需要一支 OpenAI 相容 API（內建支援 Ollama `:11434/v1`），於設定頁「LLM」區塊填寫：
- Base URL（預設 `http://<本機 IP>:11434/v1`）
- 模型名稱（預設 `qwen3-vl:4b`，需支援多模態才能「反推圖片」）
- API Key（若需要）

> LLM 連線同樣經同源代理 `/api/llm/*`（`X-LLM-BaseURL`/`X-LLM-Model`/`X-LLM-ApiKey` header），不直接外連。

## 使用方式

左欄切換模式，右欄填參數，點「生成」開始；進度即時顯示並可中斷。完成後結果自動出現在畫廊，可點開檢視、下載、或「放大」再次處理。多次生成會排入「生成佇列」（Header 有數量角標），可在 `/queue` 調整順序、載入參數或清除。

| 模式 | 需要輸入 |
|------|----------|
| 文生圖 | 提示詞、尺寸、步數、seed |
| 圖生圖 | 提示詞 + 來源圖片 + denoise |
| 文生影片 | 提示詞、解析度、時長（幀數對齊 17k+5 網格）、fps、Turbo 開關 |
| 圖生影片 | 提示詞 + 首幀（可選尾幀） |
| 圖片放大 | 來源圖片 + 倍數（2x/4x） |
| 影片放大 | 來源影片（SeedVR2 工作流） |
| 自定義 | 上傳 API/UI-format JSON 或從模板開始 |

## OpenAI API 相容層（給外部工具使用）

把 ComfyUI 的生圖能力包成 OpenAI Images API 格式，任何支援「自訂 OpenAI 相容端點」的工具（ComfyUI 以外的繪圖工具、腳本、LLM Agent 等）都能直接呼叫：

| 端點 | 說明 |
|------|------|
| `GET /api/openai/v1/models` | 列出可用模型（`z-image`、`qwen-image-2.1`） |
| `POST /api/openai/v1/images/generations` | 文生圖（JSON body） |
| `POST /api/openai/v1/images/edits` | 圖生圖／圖片編輯（multipart form，欄位 `image` 可多張） |

```bash
# 文生圖
curl -X POST http://<host>:3000/api/openai/v1/images/generations \
  -H 'Content-Type: application/json' \
  -d '{"model":"z-image","prompt":"a cute cat","size":"1024x1024","n":1}'

# 圖片編輯（z-image = img2img；qwen-image-2.1 = 多參考圖指令編輯，prompt 可用 <image1> 引用）
curl -X POST http://<host>:3000/api/openai/v1/images/edits \
  -F 'model=z-image' -F 'prompt=make it snowy' -F 'denoise=0.6' -F 'image=@cat.png'
```

- 請求欄位：`model`、`prompt`、`n`（1–4）、`size`（`寬x高`，64–4096）、`response_format`（`url` 或 `b64_json`），擴充欄位 `seed`、`steps`、`cfg`、`negative_prompt`、`denoise`（edits）。
- 回傳標準 OpenAI 格式 `{ created, data: [{ url | b64_json }] }`；`url` 經同源 view 代理，需呼叫端可達 Super Studio 位址。
- ComfyUI 位址解析：`X-ComfyUI-Host` header → `COMFYUI_HOST` 環境變數 → 預設值；認證為 `X-ComfyUI-Auth` header → `COMFYUI_AUTH` 環境變數。
- 逾時預設 600 秒，可用 `OPENAI_COMPAT_TIMEOUT_MS` 環境變數調整。
- 端點預設無驗證（適合內網）；若要公開暴露，請在前方加反向代理與驗證。
- 實作位於 `lib/openai-compat.ts` 與 `app/api/openai/v1/`，工作流直接複用 `lib/workflow-templates.ts`。

## 常用指令

```bash
npm run typecheck   # TypeScript 型別檢查
npm run lint        # ESLint
npm run build       # production build
npm start           # 執行 production 伺服器
```

## 設定檔與環境

| 檔案/位置 | 用途 |
|-----------|------|
| `app/settings/` | ComfyUI 地址、LLM 設定、主題、系統資訊（設定會存於瀏覽器 localStorage） |
| `app/queue/` | 生成佇列管理（順序、中斷、載入參數） |
| `lib/workflow-templates.ts` | 各模式工作流構建（如需對照新環境節點請依該環境 `object_info` 修正） |
| `lib/llm-client.ts` / `lib/prompt-optimizer.ts` | LLM 提示詞優化與圖片反推 |
| `docs/todolist.md` | 開發任務清單（含各項目完成判定） |

## 已知注意事項

- 幀數公式：`17k + 5`（ComfyUI 影片工作流要求），124 幀約 5 秒。
- 影片 `SaveVideo` 的 format 使用 dynamic combo 的 `auto`，勿指定固定 mime。
- 影片 `CLIPLoader` 的 `type` 為 `minimax`（非 `qwen3_vl`）。
- 工作流已依本機 v0.34 節點簽名實測驗證（`node_errors` 為空）；若升級 ComfyUI，請以 `/object_info` 重新比對。

## License / 備註

本專案為 ComfyUI 的前端工具，實際生成皆由本機 ComfyUI 執行。詳細規格與開發依據見 `docs/`。