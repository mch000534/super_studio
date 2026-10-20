# AGENTS.md

Next.js 16 (App Router) + TypeScript + Tailwind frontend workbench that proxies a user-configured ComfyUI daemon. No backend of its own. All UI strings, error messages, and docs are in Traditional Chinese (zh-Hant) — keep new user-facing text and docs in Chinese.

## Commands

- `npm run dev` — dev server at http://localhost:3000
- `npm run lint` — ESLint (config: `eslint.config.mjs`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` / `npm start` — production build / serve
- No test framework or test suite exists.

## Gotchas

- macOS `._*` AppleDouble files (from syncing the repo off macOS) break both `npm run lint` ("Parsing error: Invalid character") and `npm run dev` (Turbopack fails with `Failed to open database ... invalid digit found in string` when `._*` files sit inside `.next/`). They are git-ignored but scanners still read them. Fix: `find . -name '._*' -delete`, and if the `.next/` cache is already corrupted, also `rm -rf .next` so Turbopack rebuilds it. Don't delete the real source files.
- The repo pins an unusual **Next 16 + React 18** combo. It builds and typechecks fine; do not "upgrade"/fix React to 19.
- Node ≥ 20 required. On this machine the toolchain is in `~/.local/node/bin`; `export PATH="$HOME/.local/node/bin:$PATH"` if npx/npm aren't found.

## Architecture

- ComfyUI host is user-configurable and persisted client-side via zustand `persist` (localStorage, key prefix `super-studio:`). No env files; default host in `stores/settings-store.ts` (`DEFAULT_HOST = http://127.0.0.1:8188`, but `getDefaultHost()` derives `http://<current IP>:8188` in the browser; a storage migration rewrites saved `127.0.0.1` hosts to the current IP).
- All browser→ComfyUI HTTP goes through the same-origin proxy `app/api/comfyui/[...path]/route.ts`, which forwards to the host from the `X-ComfyUI-Host` header (with optional `X-ComfyUI-Auth` → `Authorization`). Use `lib/comfyui-client.ts` helpers; never call the ComfyUI host directly.
- The WebSocket in `lib/websocket-manager.ts` connects the browser DIRECTLY to `ws://<host>/ws?clientId=...` — it does NOT go through the proxy, so ComfyUI must be browser-reachable (this is why settings include a "test connection").
- Media streaming via `app/api/comfyui/view/route.ts` receives host/auth in the URL as `__host` / `__auth` (not headers); built by `lib/comfyui-client.ts:getViewUrl`.
- The 10 modes are registered in `lib/modes.ts`. Per-mode GPU workflows are built in `lib/workflow-templates.ts` and were validated against ComfyUI v0.34–v0.37 node signatures.
- OpenAI-compatible API lives in `app/api/openai/v1/` with shared logic in `lib/openai-compat.ts` (`/v1/models`, `/v1/images/generations`, `/v1/images/edits`). It runs server-side: resolves the ComfyUI host from `X-ComfyUI-Host` header → `COMFYUI_HOST` env → `DEFAULT_HOST`, submits the workflow, then polls `/history/<prompt_id>` (no WebSocket). No auth by default. Reuses `lib/workflow-templates.ts` builders; keep error payloads in OpenAI `{ error: { message, type, code } }` shape. `edits` defaults to `response_format=b64_json` (OpenAI gpt-image parity — clients like Cherry Studio/@ai-sdk openai-compatible reject url-only responses); only `generations` defaults to `url`. Music and 3D modes are **not** exposed via the OpenAI layer. Docs live in `ReadMe.md` and `docs/spec.md` §16, with an in-app page at `app/api-docs/page.tsx` (it derives the Base URL from the request `Host`/`x-forwarded-host` headers — don't hardcode `localhost` there).
- Path alias `@/*` → repo root. UI components are shadcn-style under `components/ui/` (Radix + cva + tailwind-merge).

## ComfyUI workflow quirks

- Video frame count must satisfy `17k + 5` — use `frameCountForDuration` in `lib/workflow-templates.ts`.
- `SaveVideo` format must stay the `auto` dynamic combo (do not pin a fixed mime); video `CLIPLoader` `type` is `minimax` (not `qwen3_vl`).
- If the backend ComfyUI is upgraded, re-verify node signatures/slots against its `/object_info`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
