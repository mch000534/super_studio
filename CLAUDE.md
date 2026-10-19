# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `AGENTS.md` for the canonical project overview, host-config model, and ComfyUI workflow quirks — read it first. This file adds detail on subsystems that file doesn't cover (LLM proxy, queue engine, image model families, custom-workflow parsing) and command references.

## Commands

```bash
npm run dev        # dev server (http://localhost:3000)
npm run lint        # ESLint (eslint.config.mjs)
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm start           # serve production build
```

No test framework/suite exists in this repo.

## Architecture beyond AGENTS.md

### State (zustand stores, `stores/`)

- `settings-store.ts` — persisted (localStorage key `super-studio-settings`, prefix helpers in `lib/storage.ts`): ComfyUI host/auth, theme, current mode, and LLM connection config (`llmBaseUrl`/`llmModel`/`llmApiKey`).
- `generation-store.ts` — the *currently displayed* generation's live state (params, progress, preview, status). Mirrors whichever queue task is executing; not itself the source of truth for queued work.
- `queue-store.ts` — the actual task list (`QueueTask[]`) with per-task status (`pending`→`queued`→`running`→`completed`/`failed`/`cancelled`), progress, and `executingPromptId`. This is what survives page navigation.
- `history-store.ts` / `gallery-store.ts` — completed-generation records and the flattened media gallery derived from them.

### Generation/queue engine (`hooks/use-generation.ts`)

This hook is the orchestrator for the whole generation pipeline and is more subtle than it looks:

- `submitNext()` drains one pending task at a time via `buildAndSubmit()`, guarded by a **module-level** `submitLock` boolean (not React state) so concurrent callers (WS events, mount effects, manual submit) can't double-submit to ComfyUI.
- `latestSubmitNext` is a module-level ref to the latest `submitNext` closure, kept fresh by an effect with no deps (`useEffect(() => { latestSubmitNext = submitNext; })`), so WebSocket callbacks registered once can still call the current version. Don't "fix" this into a stale closure by adding deps.
- Task lifecycle is driven entirely by WS events from `lib/websocket-manager.ts` (`status`, `executing`, `progress`, `execution_error`, `execution_interrupted`, `execution_success`) — `fetchResult()` pulls the final `/history/{promptId}` only on success, converts outputs to `MediaItem[]`, and calls `globalResultHandler` (registered by whoever renders results, e.g. the gallery) before advancing the queue.
- On mount, it reconciles `queue-store`'s `executingPromptId` against WS state in case a task finished while the component was unmounted (e.g. user navigated to `/queue` and back) — this is why `syncGenerationStore` exists as a separate function rather than being inlined.
- `mode === 'custom'` skips `buildWorkflow()` entirely and submits `params.customWorkflow` as-is.

### Two independent host-proxy pairs

Both follow the same pattern (same-origin proxy route + typed client) but are unrelated to each other:

| | ComfyUI | LLM |
|---|---|---|
| Route | `app/api/comfyui/[...path]/route.ts` | `app/api/llm/[...path]/route.ts` |
| Client | `lib/comfyui-client.ts` | `lib/llm-client.ts` |
| Host header | `X-ComfyUI-Host` (+ `X-ComfyUI-Auth`) | `X-LLM-BaseURL` (+ `X-LLM-Model`, `X-LLM-ApiKey`) |
| Purpose | queue/upload/history/models/system_stats | OpenAI-compatible `/chat/completions`, `/models` |

The LLM proxy backs prompt optimization and vision "describe image" (`lib/prompt-optimizer.ts` builds the chat messages incl. a JSON-only system prompt for optimize and a vision system prompt for describe; `hooks/use-llm.ts` calls `llmClient` and parses the JSON reply). It has no relation to the ComfyUI WebSocket or proxy — don't conflate the two host configs.

### Image model families (`lib/image-models.ts`)

`text2img`/`img_edit` support pluggable model families (currently `z-image` Turbo and `qwen-image-2.1`), each with its own default UNET/CLIP/VAE checkpoint names and recommended steps/cfg. `GenerationParams.imageModelId` selects the family; `workflow-templates.ts` and `components/workspace/image-model-selector.tsx` both read from `getImageModelFamily()`. When adding a model family, update this file only — consumers derive from it.

### Custom workflow support (`lib/workflow-parser.ts`, `components/workflow/`)

`parseWorkflow()` accepts either ComfyUI API-format JSON (`{nodeId: {class_type, inputs}}`) or UI/graph-format JSON (exported `.json` with `nodes[]`/`widgets_values`/link ids) and normalizes both into the same `{workflow, params, isUIFormat}` shape, inferring editable scalar params (number/float/boolean/combo) by scanning non-connection input values. `applyParamValues()` deep-clones and patches by `"nodeId.inputKey"` dotted keys. This is how `components/workflow/workflow-editor.tsx` lets a user tweak an uploaded workflow's exposed fields before running it in `custom` mode.

### Two type layers (`types/`)

- `types/workflow.ts` — app-level domain types (`Mode`, `GenerationParams`, `MediaItem`, `HistoryRecord`). This is what stores and components pass around.
- `types/comfyui.ts` — raw ComfyUI HTTP API DTOs (`WorkflowNode`, `PromptResponse`, `HistoryEntry`, `FileInfo`, etc.) used only at the `comfyui-client`/proxy boundary.
Don't mix the two — `workflow-templates.ts` is the translation layer from `GenerationParams` to `WorkflowNode` graphs.

### Modes

`lib/modes.ts` currently registers **8** modes (`text2img`, `img2img`, `img_edit`, `text2vid`, `img2vid`, `img_upscale`, `vid_upscale`, `custom`) — `img_edit` (multi-reference-image editing, up to 10 images with `<image1>`/`<image2>`… inline references) was added after AGENTS.md's "7 modes" note was last written. Treat `lib/modes.ts` as the source of truth for the mode list.

### Planning docs (`docs/`)

`requirements.md`, `spec.md`, `UIUX.md`, `todolist.md` are living planning documents maintained by this project's numbered workflow skills (`1-1-explore-requirements` through `8-2-setup-deployment`). They're a useful read for *why* a feature looks the way it does, but the code is the source of truth for *what it currently does*.
