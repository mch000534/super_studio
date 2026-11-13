# AGENTS.md

Next.js 16 (App Router) + React 18 + TypeScript + Tailwind workbench for a user-configured ComfyUI daemon. Next route handlers proxy ComfyUI/LLM and expose an OpenAI-compatible image API; there is no database, and app state lives in browser localStorage. No tests or CI. All UI strings, error messages, and docs are Traditional Chinese (zh-Hant) — keep them Chinese.

## Commands

- `npm install` first on a fresh clone — `node_modules/` is not committed.
- `npm run dev` — dev server at http://localhost:3000
- `npm run typecheck` — `tsc --noEmit`; `npm run lint` — ESLint (`eslint.config.mjs`)
- `npm run build` / `npm start` — production build / serve
- No test framework or CI. Before finishing, run `npm run typecheck && npm run lint`; also `npm run build` when routes/server code changed.

## Gotchas

- macOS `._*` AppleDouble files (from syncing the repo off macOS) break both `npm run lint` ("Parsing error: Invalid character") and `npm run dev` (Turbopack fails with `Failed to open database ... invalid digit found in string` when `._*` files sit inside `.next/`). They are git-ignored but scanners still read them. Fix: `find . -name '._*' -delete`, and if the `.next/` cache is already corrupted, also `rm -rf .next` so Turbopack rebuilds it. Don't delete the real source files.
- The repo pins an unusual **Next 16 + React 18** combo. It builds and typechecks fine; do not "upgrade"/fix React to 19.
- Node ≥ 20 required. On this machine the toolchain is in `~/.local/node/bin`; `export PATH="$HOME/.local/node/bin:$PATH"` if npx/npm aren't found.
- `lib/modes.ts` is the only source of truth for the mode list (currently 10). `CLAUDE.md` is stale on this (says 8); trust the code.

## Architecture

- Settings are persisted client-side by zustand `persist` (key `super-studio-settings`; helper prefix `super-studio:` in `lib/storage.ts`). `getDefaultHost()` derives `http://<window hostname>:8188`; a migration rewrites saved `127.0.0.1` hosts to the current IP. LLM defaults to `http://<hostname>:11434/v1` / `qwen3-vl:4b`.
- All browser→ComfyUI HTTP goes through the same-origin proxy `app/api/comfyui/[...path]/route.ts`, which forwards to `X-ComfyUI-Host` (falling back to `DEFAULT_HOST` = `127.0.0.1:8188`) with optional `X-ComfyUI-Auth` → `Authorization`. Use `lib/comfyui-client.ts` helpers; never call the ComfyUI host directly.
- The WebSocket in `lib/websocket-manager.ts` connects the browser DIRECTLY to `ws://<host>/ws?clientId=...` — it does NOT go through the proxy, so ComfyUI must be browser-reachable (this is why settings include a "test connection").
- Media streaming via `app/api/comfyui/view/route.ts` receives host/auth in the URL as `__host` / `__auth` (not headers); built by `lib/comfyui-client.ts:getViewUrl`.
- The LLM proxy is a separate host config: `app/api/llm/[...path]/route.ts` + `lib/llm-client.ts`, using `X-LLM-BaseURL` / `X-LLM-Model` / `X-LLM-ApiKey` headers. It backs prompt optimization and vision "describe image"; don't conflate it with the ComfyUI proxy.
- OpenAI-compatible API lives in `app/api/openai/v1/` with shared logic in `lib/openai-compat.ts` (`/v1/models`, `/v1/images/generations`, `/v1/images/edits`). It runs server-side: resolves the host from `X-ComfyUI-Host` → `COMFYUI_HOST` env → `DEFAULT_HOST`, submits the workflow directly to ComfyUI (not via the app proxy), then polls `/history/<prompt_id>` (no WebSocket). Auth: `X-ComfyUI-Auth` → `COMFYUI_AUTH`; timeout: `OPENAI_COMPAT_TIMEOUT_MS` (default 600 s). Only `z-image` and `qwen-image-2.1` are exposed; `edits` defaults to `response_format=b64_json` (OpenAI gpt-image parity — clients like Cherry Studio/@ai-sdk openai-compatible reject url-only responses), only `generations` defaults to `url`. Keep errors in `{ error: { message, type, code } }` shape. Music, 3D, video, and upscale modes are **not** exposed.
- `hooks/use-generation.ts` orchestrates the queue. `submitLock` and `latestSubmitNext` are **module-level** on purpose (not React state): the lock prevents double-submits from WS events/mount effects, and the latest-closure ref keeps one-time WS listeners current. Don't refactor these into state or "fix" the no-deps effect. Task lifecycle is driven by WS events; `queue-store.ts` is the source of truth for queued tasks, while `generation-store.ts` mirrors only the displayed task. `mode === 'custom'` submits `params.customWorkflow` as-is, skipping `buildWorkflow()`.
- Two type layers: `types/workflow.ts` is app-level domain types; `types/comfyui.ts` is raw ComfyUI DTOs used only at the client/proxy boundary. `lib/workflow-templates.ts` translates `GenerationParams` → `WorkflowNode` graphs.
- `hooks/use-generation.ts` maps ComfyUI outputs to media kinds. `SaveVideo` returns its MP4 under `output.images` (with `animated: true`), so the collector reclassifies `image`→`video` by file extension (`VIDEO_EXT`). Keep that when touching result handling.
- Image model families live in `lib/image-models.ts` (currently z-image Turbo and qwen-image-2.1). Add/change families there only — templates, selectors, and the OpenAI layer all derive from `getImageModelFamily()`.
- Video model families live in `lib/video-models.ts` (MiniMax H3 and FastVideo FastH3). `params.videoModelId` selects one (`getVideoModelFamily` falls back to `minimax-h3`); `components/workspace/video-controls.tsx` maps the MiniMax standard/turbo variant onto `turboMode` and clears custom file names on change. FastH3 is not exposed to the OpenAI layer.
- `lib/workflow-parser.ts` accepts both ComfyUI API-format and UI/graph-format JSON, normalizes them, and patches params by `"nodeId.inputKey"` keys. This powers `custom` mode's workflow editor.
- Path alias `@/*` → repo root. UI components are shadcn-style under `components/ui/` (Radix + cva + tailwind-merge).

## ComfyUI workflow quirks

- Video frame count must satisfy `17k + 5` — use `frameCountForDuration` in `lib/workflow-templates.ts`.
- MiniMax H3 video uses `KSampler` (+ optional Turbo LoRA); FastVideo FastH3 uses `SamplerCustomAdvanced` + `BasicScheduler`(8) + `BasicGuider` + `KSamplerSelect`(`res_multistep`) + `RandomNoise`, with `MiniMaxH3SigmaShift` → `ModelAttentionBackend`(`comfy kitchen attention`) → `BlockSparseAttention`. Do not route FastH3 through `KSampler`.
- `BlockSparseAttention` is a dynamic-combo node: in API format pass flattened keys (`selection: 'vsa'`, `'selection.keep_percent': 10`), which ComfyUI reconstructs into a nested dict. FastH3 snaps width/height to multiples of 32 and requires `comfy kitchen attention` to be available on the backend.
- `SaveVideo` format must stay the `auto` dynamic combo (do not pin a fixed mime); video and music `CLIPLoader` `type` is `minimax` (not `qwen3_vl`).
- Music output uses `SaveAudioMP3` at `320k`; the history output key is `audio`.
- 3D `RemeshMesh` needs the `sign_mode` sub-inputs (`sign_mode.qef`, `sign_mode.drop_inverted_components`, `sign_mode.drop_enclosed_components`) or ComfyUI rejects the graph via `node_errors`.
- If the backend ComfyUI is upgraded, re-verify node signatures/slots against its `/object_info`.

## Docs

- `ReadMe.md` is user-facing setup/model list; `docs/spec.md` §16 documents the OpenAI layer; `docs/*.md` are living planning docs — code wins when they disagree.
- `CLAUDE.md` has useful deeper notes on the queue engine, LLM proxy, image families, and custom workflows, but verify details against the code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
