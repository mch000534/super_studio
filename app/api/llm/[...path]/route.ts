import { NextRequest } from 'next/server';

function resolveHeaders(req: NextRequest) {
  const baseUrl = (req.headers.get('X-LLM-BaseURL') || '').replace(/\/+$/, '');
  const model = req.headers.get('X-LLM-Model') || '';
  const apiKey = req.headers.get('X-LLM-ApiKey') || '';
  return { baseUrl, model, apiKey };
}

async function proxyRequest(req: NextRequest, path: string) {
  const { baseUrl, model, apiKey } = resolveHeaders(req);

  if (!baseUrl) {
    return Response.json(
      { error: { code: 'config_missing', message: '尚未設定 LLM 位址，請先到「設定」完成配置' } },
      { status: 400 }
    );
  }

  const target = `${baseUrl}/${path}`;
  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const method = req.method;
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = req.headers.get('content-type') || 'application/json';
    const text = await req.text();
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      if (model && !json.model) json.model = model;
      body = JSON.stringify(json);
    } catch {
      body = text;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
    });
  } catch {
    return Response.json(
      { error: { code: 'connection_failed', message: `無法連接到 LLM 服務：${baseUrl}` } },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    let detail = `上游回應 ${upstream.status}`;
    try {
      const data = (await upstream.json()) as { error?: { message?: string } };
      if (data?.error?.message) detail = data.error.message;
    } catch {
      // ignore
    }
    return Response.json(
      { error: { code: 'upstream_error', message: detail } },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  const ct = upstream.headers.get('content-type');
  if (ct) responseHeaders.set('Content-Type', ct);

  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  const search = req.nextUrl.search;
  return proxyRequest(req, `${path.join('/')}${search}`);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  const search = req.nextUrl.search;
  return proxyRequest(req, `${path.join('/')}${search}`);
}