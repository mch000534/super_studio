# Super Studio — 開發任務清單 (Todo List)

> 本文件由 `requirements.md`、`spec.md`、`UIUX.md` 分析拆解而來。
> 每個任務均含清晰的「完成判定」，實作後可對照驗證。
> 勾選框 `[ ]` 表示待辦，實作完成後改為 `[x]`。

---

## A. Phase 0 — 專案初始化與工具鏈

- [x] **A1. 初始化 Next.js 專案**
  - 於 `super_studio/` 建立 Next.js 16（App Router）+ TypeScript。
  - 完成判定：`npm run dev` 可啟動，首頁 render 成功。

- [x] **A2. 安裝並設定 Tailwind + PostCSS**
  - 完成判定：Tailwind 樣式生效，`tailwind.config.ts`、`postcss.config.js` 就緒。

- [x] **A3. 初始化 shadcn/ui 並新增基底元件**
  - 加入 Button、Input、Card、Select、Slider、Dialog、Sheet、Tabs、Textarea、Switch、Progress、Toast、DropdownMenu、Badge、SegmentedControl（或 RadioGroup 替代）。
  - 完成判定：`components/ui/` 下有上述元件，可正常 import。

- [x] **A4. 安裝輔助依賴**
  - Zustand、lucide-react、next-themes、clsx、tailwind-merge、class-variance-authority、@radix-ui 相關。
  - 完成判定：`package.json` 包含所需套件且無版本衝突。

- [x] **A5. 建立 sitemap/版面骨架**
  - `app/layout.tsx`（字體、主題 provider）、`app/globals.css`（CSS 變量）。
  - 完成判定：hello 頁可顯示，明暗自適應。

---

## B. Phase 1 — 基礎框架（US-01）

### B1. 類型定義
- [x] **B1.1 建立 ComfyUI 類型**（`types/comfyui.ts`）
  - `ServerInfo`、`PromptRequest/Response`、`WorkflowNode`、`HistoryEntry`、`FileInfo`、`WSEvent`、`WSMessage`。
  - 完成判定：型別可供 lib 與 components 引用。

- [x] **B1.2 建立工作流類型**（`types/workflow.ts`）
  - `WorkflowTemplate`、`GenerationParams`、`Mode`、`HistoryRecord`、`MediaItem`。
  - 完成判定：`Mode = 'text2img' | 'img2img' | 'text2vid' | 'img2vid' | 'img_upscale' | 'vid_upscale' | 'custom'`。

### B2. 設定 Store 與持久化
- [x] **B2.1 建立 settings-store**（`stores/settings-store.ts`）
  - 狀態：`comfyuiHost`、`theme`、`currentMode`、`authHeader?`。
  - 動作：`setHost`、`setTheme`、`setMode`。
  - 完成判定：存入 localStorage，刷新後恢復。

- [x] **B2.2 封裝 storage**（`lib/storage.ts`）
  - 泛型 `getItem/setItem/removeItem`，含 JSON 序列化與版本 key。
  - 完成判定：資料可跨 session 讀寫。

- [x] **B2.3 設定主題機制**（next-themes）
  - 亮/暗/系統切換，同步 `<html>` class。
  - 完成判定：Header 切換即時生效且持久化。

### B3. ComfyUI Client（代理）
- [x] **B3.1 建立通用代理 Route**（`app/api/comfyui/[...path]/route.ts`）
  - 泛用 GET/POST 轉發，讀取 `X-ComfyUI-Host` header，保留 body 與 status。
  - 完成判定：`GET /api/comfyui/...` 可轉發至 ComfyUI。

- [x] **B3.2 建立專用代理 Route**
  - `prompt`、`upload`（/upload/image）、`upload-video`（/upload/video）、`history/[id]`、`view`（二進位串流）、`object_info`、`models/[folder]`、`system_stats`。
  - 完成判定：所有 requirements 4.3 列出的端點可用。

- [x] **B3.3 建立 comfyui-client**（`lib/comfyui-client.ts`）
  - `testConnection`、`queuePrompt`、`interrupt`、`getHistory`、`uploadImage`、`uploadVideo`、`getViewUrl`、`listModels`。
  - 統一回傳 `{ ok, data }` 或 `{ ok:false, error }`。
  - 完成判定：方法對應 requirements 3.x 的呼叫需求。

- [x] **B3.4 錯誤正規化與超時處理**
  - 非 2xx、Timeout、`nodeErrors` 解析。
  - 完成判定：錯誤統一為 `{ code, message, nodeErrors? }`。

### B4. WebSocket 管理器
- [x] **B4.1 建立 websocket-manager**（`lib/websocket-manager.ts`）
  - 連線、單一連線共享、`client_id`。
  - 事件分發（status/executing/progress/execution_success/error/interrupted）。
  - 完成判定：可連接 `ws://host/ws?clientId=xxx`。

- [x] **B4.2 二進位預覽訊息處理**
  - 解析 8-byte header + 圖片資料 → Blob → ObjectURL。
  - 釋放舊 ObjectURL。
  - 完成判定：預覽圖片可即時顯示且不洩漏記憶體。

- [x] **B4.3 重連機制（指數退避）**
  - 1s→2s→…→30s，沿用同一 client_id。
  - 完成判定：斷線後自動恢復並重新取佇列狀態。

- [x] **B4.4 包裝 use-websocket hook**（`hooks/use-websocket.ts`）
  - 暴露事件訂閱與連線狀態。
  - 完成判定：組件可用 hook 訂閱事件。

### B5. 設定頁與連接狀態
- [x] **B5.1 建立設定頁**（`app/settings/page.tsx` + `components/settings/comfyui-config.tsx`）
  - 地址輸入、保存、測試連接、系統資訊卡。
  - 完成判定：符合 US-01 第一條（測試連接顯示版本/設備/VRAM）。

- [x] **B5.2 建立系統資訊元件**（`components/settings/system-info.tsx`）
  - 顯示版本、GPU、VRAM 使用率。
  - 完成判定：系統資訊正確顯示。

- [x] **B5.3 建立使用-comfyui hook**（`hooks/use-comfyui.ts`）
  - 啟動時自動讀地址並連線，暴露 `isConnected`。
  - 完成判定：符合 US-01 第二條（刷新自動連接）。

- [x] **B5.4 建立 Header 連接狀態指示器**（`components/layout/header.tsx`）
  - 綠/黃/紅狀態點 + 導航連結 + 主題切換。
  - 完成判定：狀態指示正確，未連線時禁用生成。

- [x] **B5.5 未連線引導**
  - 未連線時生成按鈕禁用 + 引導提示。
  - 完成判定：符合 US-01 第三條。

---

## C. Phase 2 — 文生圖（US-02）

### C1. 工作流模板
- [x] **C1.1 建立 workflow-templates**（`lib/workflow-templates.ts`）
  - `buildText2Img(params)` 產生 Z-Image-Turbo workflow（對照 requirements 5.1）。
  - 完成判定：輸出符合 API-format，cfg=1、sampler=res_multistep、scheduler=simple。

- [x] **C1.2 參數校驗工具**（`lib/utils.ts`）
  - 尺寸需為 32 倍數、範圍檢查。
  - 完成判定：非法參數在提交前被攔截。

### C2. 右欄參數面板
- [x] **C2.1 建立 prompt-panel**（`components/workspace/prompt-panel.tsx`）
  - 提示詞 Textarea + 可收起負向提示詞。
  - 完成判定：對應 UIUX 5.1。

- [x] **C2.2 建立 parameter-controls**（`components/workspace/parameter-controls.tsx`）
  - Steps、CFG、尺寸（比例按鈕 + 自訂）、Seed（🎲 隨機）、批次。
  - 完成判定：對應 UIUX 5.1；🎲 產生隨機 seed。

- [x] **C2.3 建立 model-selector**（`components/workspace/model-selector.tsx`）
  - 模型下拉（動態取 `/models/`）。
  - 完成判定：下拉列出 `z_image_turbo_bf16.safetensors` 等。

### C3. 生成流程
- [x] **C3.1 建立 generation-store**（`stores/generation-store.ts`）
  - 狀態：`params`、`status`、`progress`、`currentNode`、`promptId`、`preview`、`error`。
  - 完成判定：狀態供 UI 讀寫。

- [x] **C3.2 建立 use-generation hook**（`hooks/use-generation.ts`）
  - 綁定 client + WebSocket + store（submit/interrupt/reset）。
  - 完成判定：符合 spec §13 端到端時序。

- [x] **C3.3 建立 generation-controls**（`components/workspace/generation-controls.tsx`）
  - 生成/中斷按鈕 + 進度條。
  - 完成判定：符合 US-02 中斷、US-08 進度。

- [x] **C3.4 生成中卡片與即時預覽**
  - 置頂進度卡、節點名稱、`x/y 步`、預覽圖、剩餘佇列。
  - 完成判定：符合 UIUX §6；進度即時更新。

- [x] **C3.5 提交與完成處理**
  - `queuePrompt` → 記錄 prompt_id → 成功後 `getHistory` → 收集輸出。
  - 完成判定：生成完成後畫廊出現結果圖。

### C4. 畫廊
- [x] **C4.1 建立 output-gallery**（`components/gallery/output-gallery.tsx`）
  - 網格、最新置頂、lazy loading、空狀態。
  - 完成判定：對應 UIUX §2.3、§7。

- [x] **C4.2 建立 media-card**（`components/gallery/media-card.tsx`）
  - 圖片/影片卡片、hover 操作列、下載/放大/詳情。
  - 完成判定：符合 UIUX §7.1。

- [x] **C4.3 建立 image-viewer 燈箱**（`components/gallery/image-viewer.tsx`）
  - 放大縮小、拖曳、左右切換、Esc、meta 顯示。
  - 完成判定：符合 UIUX §7.2。

---

## D. Phase 3 — 圖生圖 + 影片（US-03/04/05）

### D1. 圖生圖
- [x] **D1.1 建立 image-upload**（`components/workspace/image-upload.tsx`）
  - 拖放/點擊上傳、預覽、更換/移除、格式驗證。
  - 完成判定：符合 US-03 第三條格式驗證。

- [x] **D1.2 圖生圖工作流**
  - `buildImg2Img(params)`：LoadImage→VAEEncode→KSampler(denoise)。
  - 上傳後取得 name 填入 LoadImage。
  - 完成判定：符合 US-03 第一、二條。

- [x] **D1.3 denoise 滑桿**
  - 0-1 滑桿即時顯示。
  - 完成判定：UIUX 5.2。

### D2. 文生影片
- [x] **D2.1 建立 video-controls**（`components/workspace/video-controls.tsx`）
  - 解析度、時長、fps、模型、Turbo 開關。
  - 完成判定：UIUX 5.3。

- [x] **D2.2 MiniMax H3 文生影片工作流**
  - `buildText2Vid(params)`：無首幀的 H3 節點圖 + SaveVideo。
  - 時長→幀數公式。
  - 完成判定：符合 spec §5.3。

- [x] **D2.3 建立 video-player**（`components/gallery/video-player.tsx`）
  - 播放/暫停/拖動、meta（時長/解析度/大小）。
  - 完成判定：符合 US-04 第三條。

### D3. 圖生影片
- [x] **D3.1 圖生影片工作流**
  - `buildImg2Vid(params)`：首幀（+ 可選尾幀）。
  - 完成判定：符合 US-05 第一、二條。

- [x] **D3.2 Turbo 模式整合**
  - 用 LoRA + 少步驟 vs 標準模型 + 多步驟。
  - 完成判定：符合 US-05 第三條（速度明顯加快）。

### D4. 通用支援
- [x] **D4.1 影片上傳代理驗證**
  - `/upload/video` 端點可用。
  - 完成判定：源影片可上傳至 ComfyUI input。

- [x] **D4.2 模式切換與面板聯動**
  - 左欄切模式 → 右欄組件切換。
  - 完成判定：UIUX §2.4。

---

## E. Phase 4 — 圖片/影片放大（US-09/10）

### E1. 圖片放大
- [x] **E1.1 圖片放大工作流**
  - `buildImgUpscale(source, scale)`：RealESRGAN ×4，2x 加 ImageScale。
  - 完成判定：對照 requirements 5.3。

- [x] **E1.2 建立 upscale-controls**（`components/workspace/upscale-controls.tsx`）
  - 放大倍數（2x/4x）+ 放大模型下拉。
  - 完成判定：UIUX 5.5。

- [x] **E1.3 建立放大控制/彈窗**（`components/workspace/upscale-controls.tsx` + `upscale-dialog.tsx`）
  - 放大倍數（2x/4x）＋來源媒體選擇彈窗（自畫廊卡片觸發，含上傳處理）。
  - 完成判定：UIUX 5.5。

### E2. 影片放大
- [x] **E2.1 SeedVR2 影片放大工作流**
  - `buildVidUpscale(source)`：LoadVideo→SeedVR2 節點→SaveVideo。
  - 完成判定：符合 US-10 第一條。

- [x] **E2.2 影片放大 UI**
  - 來源影片選擇、模型、進階設定。
  - 完成判定：UIUX 5.6。

### E3. 畫廊放大操作
- [x] **E3.1 放大入口**
  - 卡片「放大」→ 切到對應放大模式並帶入來源。
  - 完成判定：UIUX §7.4。

- [x] **E3.2 放大結果與對比**
  - 放大後新卡 + 前後解析度對比浮層。
  - 完成判定：符合 US-09/10 第二條。

- [x] **E3.3 多次放大提示**
  - 對已放大媒體再次放大時提示。
  - 完成判定：符合 US-09 第三條。

---

## F. Phase 5 — 進階功能（US-06/07）

### F1. 自定義工作流
- [x] **F1.1 建立 workflow-parser**（`lib/workflow-parser.ts`）
  - API-format 解析、可設定節點偵測（純量 vs 連接）。
  - 完成判定：符合 spec §6.2。

- [x] **F1.2 UI-format 轉換（選用）**
  - 若用戶傳 UI-format（nodes/links）則轉 API-format。
  - 完成判定：符合 spec §5.1。

- [x] **F1.3 動態參數面板**（`components/workflow/workflow-params.tsx`）
  - 依型別產生控制項（文字/數字/開關/下拉）。
  - 完成判定：符合 spec §6.3。

- [x] **F1.4 工作流上傳**（`components/workflow/workflow-upload.tsx`）
  - 上傳 JSON、或自現有模板開始。
  - 完成判定：UIUX 5.7。

- [x] **F1.5 工作流編輯器**（`components/workflow/workflow-editor.tsx`）
  - JSON 檢視/編輯、導出下載。
  - 完成判定：符合 US-06 第三條。

- [x] **F1.6 儲存/載入自定義工作流（可選）**
  - localStorage 儲存已載入工作流。
  - 完成判定：可快速重用。

### F2. 歷史記錄
- [x] **F2.1 建立 history-store**（`stores/history-store.ts`）
  - 記錄模型（id/timestamp/mode/prompt/params/thumbnail/media）。
  - 完成判定：符合 spec §7.1。

- [x] **F2.2 歷史寫入**
  - 生成完成後自動寫入快照。
  - 完成判定：符合 spec §7.3。

- [x] **F2.3 建立歷史頁**（`app/history/page.tsx`）
  - 列表、篩選（模式/時間）、重新載入、批量刪除。
  - 完成判定：符合 US-07 全部三條。

### F3. 畫廊 Store 拆分
- [x] **F3.1 建立 gallery-store**（`stores/gallery-store.ts`）
  - 畫廊資料與操作獨立於 history-store。
  - 完成判定：畫廊與歷史資料可獨立更新。

---

## H. Phase 6 — 生成佇列與 LLM 整合

### H1. 生成佇列
- [x] **H1.1 建立 queue-store**（`stores/queue-store.ts`）
  - 任務資料模型（status：pending/queued/running/completed/failed/cancelled）、add/remove/move/update。
  - 完成判定：多次生成可入列且狀態正確流轉。

- [x] **H1.2 建立佇列頁**（`app/queue/page.tsx`）
  - 進行中／已完成分區、全選、批次刪除、清除已完成、重新排序（pending 可上移/下移）。
  - 完成判定：佇列操作符合 UIUX §2.2/§8 擴充。

- [x] **H1.3 佇列計數整合**
  - Header 角標與左欄「生成佇列」連結顯示待處理數。
  - 完成判定：角落標即時反映 pending 數量。

- [x] **H1.4 佇列與生成流程整合**
  - `use-generation` 支援 `cancelTask(id)`，刪除執行中/佇列中任務時先中斷。
  - 完成判定：佇列中斷與參數重載可使用。

### H2. LLM 提示詞優化
- [x] **H2.1 建立 LLM 代理路徑**（`app/api/llm/[...path]/route.ts`）
  - 依 `X-LLM-BaseURL`/`X-LLM-Model`/`X-LLM-ApiKey` header 轉發至 OpenAI 相容 API。
  - 完成判定：`/api/llm/chat/completions` 與 `/api/llm/models` 可用。

- [x] **H2.2 建立 llm-client**（`lib/llm-client.ts`）
  - `chat`、`test` 方法，統一回傳 `{ ok, data }`/`{ ok:false, error }`。
  - 完成判定：錯誤正規化與 comfyui-client 一致。

- [x] **H2.3 建立 prompt-optimizer**（`lib/prompt-optimizer.ts`）
  - 系統提示詞、`buildOptimizeMessages`、`buildDescribeMessages`、`parseOptimizedPrompt`。
  - 完成判定：可將口語描述擴充為英文正向/負向提示詞並解析回填。

- [x] **H2.4 提示詞面板整合**
  - `prompt-panel` 加入「優化提示詞」/「反推圖片並優化」按鈕。
  - 完成判定：優化結果回填正向/負向輸入框並 toast 提示。

- [x] **H2.5 設定頁 LLM 區塊**（`components/settings/llm-config.tsx`）
  - Base URL / Model / API Key 輸入與連線測試。
  - 完成判定：設定持久化且測試成功/失敗有明確回饋。

---

## G. 品質與收尾

- [x] **G1. TypeScript 型別檢查**
  - `npm run typecheck`（若有）無錯誤。
  - 完成判定：通過。

- [x] **G2. Lint**
  - `npm run lint` 無錯誤。
  - 完成判定：通過。

- [x] **G3. 建置驗證**
  - `npm run build` 成功。
  - 完成判定：production build 產出。

- [x] **G4. 與本機 ComfyUI 整合測試**
  - 實連 127.0.0.1:8188，逐模式跑通文生圖、圖生圖、文/圖生影片、放大。
  - 完成判定：requirements 各 US 驗收標準可對照通過。

- [x] **G5. 響應式檢查**
  - 桌面三欄、平板抽屜、手機 Sheet。
  - 完成判定：UIUX §12 斷點正確。

---

## 里程碑對應（requirements §7）

| requirements Phase | 對應本清單 |
|--------------------|------------|
| Phase 1 基礎框架    | A, B |
| Phase 2 文生圖      | C |
| Phase 3 圖生圖+影片 | D |
| Phase 4 放大        | E |
| Phase 5 進階        | F |
| Phase 6 佇列 + LLM  | H |
| 收尾               | G |

---

## 任務依賴關係（簡要）

```
A1-A5（初始化）
   └─ B1(型別) → B2(store) → B3(client) → B4(ws) → B5(設定/狀態)
        └─ C1(模板) → C2(面板) → C3(流程) → C4(畫廊)
             └─ D1(圖生圖) → D2/D3(影片) → D4(模式聯動)
                  └─ E1/E2(放大) → E3(畫廊放大)
                       └─ F1(自定義) → F2(歷史) → F3(畫廊拆分)
                            └─ H(佇列 + LLM)
                                 └─ G(品質收尾)
```

---

*本清單基於三份文件拆解，實作時可逐項勾選追蹤。*
