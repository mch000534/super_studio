import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IMAGE_MODEL_FAMILIES } from '@/lib/image-models';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/openai/v1/models',
    desc: '列出可用的生圖模型（OpenAI 格式）',
  },
  {
    method: 'POST',
    path: '/api/openai/v1/images/generations',
    desc: '文字生成圖片（JSON 請求）',
  },
  {
    method: 'POST',
    path: '/api/openai/v1/images/edits',
    desc: '參考圖編輯／圖生圖（multipart 請求）',
  },
];

export const metadata = {
  title: 'OpenAI 相容 API — Super Studio',
  description: '以 OpenAI 格式呼叫本機 ComfyUI 生圖能力的相容層說明',
};

function Field({
  name,
  type,
  required,
  desc,
}: {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
}) {
  return (
    <div className="border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{name}</code>
        <span className="font-mono text-xs text-muted-foreground">{type}</span>
        {required ? (
          <Badge variant="default" className="text-[10px]">
            必填
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            選填
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export default function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">OpenAI 相容 API</h1>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Super Studio 提供一組與 OpenAI Images API 相容的端點，讓外部工具（Cherry Studio、Open WebUI、
        LangChain、<code className="font-mono">@ai-sdk/openai-compatible</code> 等）直接以 OpenAI
        格式呼叫本機 ComfyUI 的生圖能力。請求由本專案的伺服器端接收、組出工作流、送進 ComfyUI，再輪詢
        <code className="font-mono"> /history</code> 取回結果，全程不需 WebSocket，也不需在前端開著頁面。
      </p>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">端點一覽</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              將客戶端的 Base URL 設為 <code className="font-mono">http://&lt;主機&gt;:3000/api/openai/v1</code>
              （工作台開發時預設為 <code className="font-mono">npm run dev</code> 的 3000 埠）。
            </p>
            <div className="overflow-hidden rounded-lg border">
              {ENDPOINTS.map((e) => (
                <div
                  key={e.path}
                  className="flex flex-col gap-1 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
                >
                  <Badge
                    variant={e.method === 'GET' ? 'secondary' : 'default'}
                    className="w-fit font-mono text-[10px]"
                  >
                    {e.method}
                  </Badge>
                  <code className="font-mono text-xs">{e.path}</code>
                  <span className="text-sm text-muted-foreground sm:ml-auto">{e.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              所有端點都支援 CORS 預檢（<code className="font-mono">OPTIONS</code>），回應允許任意來源。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ComfyUI 主機與認證</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              每個請求都可帶上要連線的 ComfyUI 位址；未提供時依序退回環境變數與預設值：
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                <code className="font-mono">X-ComfyUI-Host</code> 請求標頭（例如
                <code className="font-mono"> http://127.0.0.1:8188</code>）
              </li>
              <li>
                <code className="font-mono">COMFYUI_HOST</code> 環境變數
              </li>
              <li>
                <code className="font-mono">DEFAULT_HOST</code>（內建預設
                <code className="font-mono"> http://127.0.0.1:8188</code>）
              </li>
            </ol>
            <p>
              若 ComfyUI 需要認證，用 <code className="font-mono">X-ComfyUI-Auth</code> 標頭（整串
              <code className="font-mono"> Authorization</code> 值）或
              <code className="font-mono"> COMFYUI_AUTH</code> 環境變數提供；本相容層預設不驗證呼叫方。
            </p>
            <p>
              逾時預設 600 秒，可用環境變數
              <code className="font-mono"> OPENAI_COMPAT_TIMEOUT_MS</code>（毫秒）調整。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">可用模型</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              未指定 <code className="font-mono">model</code> 時預設為
              <code className="font-mono"> z-image</code>；傳入未知模型會回 404
              <code className="font-mono"> model_not_found</code>。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">模型 ID</th>
                    <th className="py-2 pr-4 font-medium">建議步數</th>
                    <th className="py-2 font-medium">建議 CFG</th>
                  </tr>
                </thead>
                <tbody>
                  {IMAGE_MODEL_FAMILIES.map((m) => (
                    <tr key={m.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">
                        <code className="font-mono text-xs">{m.id}</code>
                        <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
                      </td>
                      <td className="py-2 pr-4 font-mono">{m.recommended.steps}</td>
                      <td className="py-2 font-mono">{m.recommended.cfg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              文生圖 <code className="font-mono text-sm">POST /images/generations</code>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">
              請求主體為 JSON，回應為 <code className="font-mono">{'{ created, data: [...] }'}</code>。
            </p>
            <Field name="prompt" type="string" required desc="正向提示詞。" />
            <Field name="model" type="string" desc="模型 ID，預設 z-image。" />
            <Field name="n" type="integer" desc="生成張數，1–4，預設 1。" />
            <Field
              name="size"
              type="string"
              desc="「寬x高」（例如 1024x1536），寬高需介於 64–4096；預設 1024x1024，auto 同預設。"
            />
            <Field
              name="response_format"
              type="string"
              desc="url（預設）或 b64_json。url 會回本專案的 /api/comfyui/view 代理網址。"
            />
            <Field name="seed" type="number" desc="隨機種子，-1 表示隨機，預設 -1。" />
            <Field name="steps" type="number" desc="取樣步數，預設依模型建議值。" />
            <Field name="cfg" type="number" desc="CFG 強度，預設依模型建議值。" />
            <Field name="negative_prompt" type="string" desc="負向提示詞。" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              圖片編輯 <code className="font-mono text-sm">POST /images/edits</code>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">
              請求為 <code className="font-mono">multipart/form-data</code>。回應格式同文生圖，但
              <code className="font-mono"> response_format</code> 預設為
              <code className="font-mono"> b64_json</code>（與 OpenAI 官方 edits、以及多數客戶端的
              schema 期待一致），需要網址時請明確傳 <code className="font-mono">url</code>。
            </p>
            <Field
              name="image"
              type="file[]"
              required
              desc="參考圖片，可重複附加多張（最多 10 張）。"
            />
            <Field name="prompt" type="string" required desc="編輯指令。" />
            <Field
              name="model"
              type="string"
              desc="z-image 走單圖 img2img；qwen-image-2.1 為多參考圖指令編輯，prompt 可用 <image1>、<image2> 引用。"
            />
            <Field name="n" type="integer" desc="生成張數，1–4，預設 1。" />
            <Field name="size" type="string" desc="「寬x高」，規則同文生圖。" />
            <Field
              name="response_format"
              type="string"
              desc="b64_json（預設）或 url。"
            />
            <Field name="denoise" type="number" desc="改動幅度 0–1，僅 z-image 使用，預設 0.6。" />
            <Field name="seed" type="number" desc="隨機種子，-1 表示隨機。" />
            <Field name="steps" type="number" desc="取樣步數，預設依模型建議值。" />
            <Field name="cfg" type="number" desc="CFG 強度，預設依模型建議值。" />
            <Field name="negative_prompt" type="string" desc="負向提示詞。" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">使用範例</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">查詢模型</p>
              <Code>{`curl http://localhost:3000/api/openai/v1/models`}</Code>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">文字生成圖片</p>
              <Code>{`curl http://localhost:3000/api/openai/v1/images/generations \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "qwen-image-2.1",
    "prompt": "一隻在雪地奔跑的柴犬，電影感光影",
    "size": "1024x1024",
    "n": 2
  }'`}</Code>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">圖片編輯（multipart）</p>
              <Code>{`curl http://localhost:3000/api/openai/v1/images/edits \\
  -F "model=qwen-image-2.1" \\
  -F "prompt=把背景換成黃昏的海邊" \\
  -F "image=@input.png" \\
  -F "response_format=url"`}</Code>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">指定其他 ComfyUI 主機</p>
              <Code>{`curl http://localhost:3000/api/openai/v1/images/generations \\
  -H "X-ComfyUI-Host: http://192.168.1.50:8188" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "cat"}'`}</Code>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">錯誤格式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              錯誤回應沿用 OpenAI 結構，方便客戶端統一處理：
            </p>
            <Code>{`{
  "error": {
    "message": "prompt 欄位為必填",
    "type": "invalid_request_error",
    "param": null,
    "code": "invalid_request_error"
  }
}`}</Code>
            <p className="text-sm text-muted-foreground">
              常見的 <code className="font-mono">code</code>：參數錯誤回
              <code className="font-mono"> invalid_request_error</code>（400）、模型不存在回
              <code className="font-mono"> model_not_found</code>（404）、連不上 ComfyUI 回
              <code className="font-mono"> comfyui_unreachable</code>（502）、逾時回
              <code className="font-mono"> timeout</code>（504）。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">涵蓋範圍</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              此相容層目前只涵蓋<strong className="text-foreground">文生圖</strong>與
              <strong className="text-foreground">圖片編輯</strong>兩種能力。
            </p>
            <p>
              工作台內的影片、放大、<strong className="text-foreground">音樂</strong>、
              <strong className="text-foreground">3D</strong> 等模式尚未開放 OpenAI 相容端點，
              請直接在工作台操作；影片與音訊結果仍可從歷史記錄或畫廊下載。
            </p>
            <p>
              ComfyUI 主機必須是本伺服器可連線的位址（相容層走 server-to-server 呼叫），與工作台
              前端的 WebSocket 直連需求不同。
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
