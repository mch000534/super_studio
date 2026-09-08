import { NextRequest } from 'next/server';
import { DEFAULT_HOST } from '@/stores/settings-store';

function resolveHost(req: NextRequest): string {
  const headerHost = req.headers.get('X-ComfyUI-Host');
  return headerHost || DEFAULT_HOST;
}

async function proxyRequest(req: NextRequest, path: string) {
  const host = resolveHost(req).replace(/\/$/, '');
  const target = `${host}/${path}`;

  const headers: Record<string, string> = {};
  const authHeader = req.headers.get('X-ComfyUI-Auth');
  if (authHeader) headers['Authorization'] = authHeader;

  const method = req.method;
  let body;
  const contentType = req.headers.get('content-type') || '';
  if (method !== 'GET' && method !== 'HEAD') {
    body = contentType.includes('multipart/form-data')
      ? await req.formData()
      : await req.text();
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
      { error: { code: 'connection_failed', message: `無法連接到 ComfyUI: ${host}` } },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  const upstreamCT = upstream.headers.get('content-type');
  if (upstreamCT) responseHeaders.set('Content-Type', upstreamCT);
  const ct = upstream.headers.get('content-length');
  if (ct) responseHeaders.set('Content-Length', ct);

  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const search = req.nextUrl.search;
  return proxyRequest(req, `${path}${search}`);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const search = req.nextUrl.search;
  return proxyRequest(req, `${path}${search}`);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const search = req.nextUrl.search;
  return proxyRequest(req, `${path}${search}`);
}
