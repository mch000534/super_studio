import { NextRequest } from 'next/server';
import { DEFAULT_HOST } from '@/stores/settings-store';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const filename = search.get('filename');
  if (!filename) {
    return Response.json({ error: 'filename required' }, { status: 400 });
  }

  const subfolder = search.get('subfolder') || '';
  const type = search.get('type') || 'output';
  const preview = search.get('preview');
  const res = search.get('res');

  const hostParam = search.get('__host');
  const host = hostParam ? decodeURIComponent(hostParam) : DEFAULT_HOST;
  const authHeader = search.get('__auth');

  const params = new URLSearchParams({ filename, subfolder, type });
  if (preview) params.set('preview', preview);
  if (res) params.set('res', res);

  const headers: Record<string, string> = {};
  if (authHeader && authHeader.trim()) {
    headers['Authorization'] = decodeURIComponent(authHeader);
  }
  if (req.headers.get('range')) {
    headers['Range'] = req.headers.get('range') as string;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${host.replace(/\/$/, '')}/view?${params.toString()}`, {
      method: 'GET',
      headers,
    });
  } catch {
    return Response.json({ error: 'connection_failed' }, { status: 502 });
  }

  const responseHeaders = new Headers();
  if (upstream.headers.get('content-type')) {
    responseHeaders.set('Content-Type', upstream.headers.get('content-type') as string);
  }
  if (upstream.headers.get('content-length')) {
    responseHeaders.set('Content-Length', upstream.headers.get('content-length') as string);
  }
  if (upstream.headers.get('accept-ranges')) {
    responseHeaders.set('Accept-Ranges', upstream.headers.get('accept-ranges') as string);
  }
  const contentRange = upstream.headers.get('content-range');
  if (contentRange) responseHeaders.set('Content-Range', contentRange);
  if (upstream.status === 206) {
    const partialStart = upstream.headers.get('content-range');
    responseHeaders.set('Content-Range', partialStart as string);
  }

  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
