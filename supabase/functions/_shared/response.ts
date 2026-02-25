import { corsHeaders } from './cors.ts';

export function jsonResponse(data: unknown, status = 200, cacheMaxAge?: number) {
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (cacheMaxAge) {
    headers['Cache-Control'] = `public, max-age=${cacheMaxAge}`;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function successResponse(data: unknown, meta?: Record<string, unknown>, cacheMaxAge?: number) {
  return jsonResponse({
    data,
    meta: {
      requestId: `req_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      ...meta,
    },
  }, 200, cacheMaxAge);
}

export function listResponse(data: unknown[], pagination: { total: number; limit: number; offset: number }, cacheMaxAge?: number) {
  return jsonResponse({
    data,
    pagination: {
      ...pagination,
      hasMore: pagination.offset + pagination.limit < pagination.total,
    },
    meta: {
      requestId: `req_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  }, 200, cacheMaxAge);
}

export function errorResponse(code: string, message: string, status: number, details?: Record<string, unknown>) {
  return jsonResponse({
    error: { code, message, details: details || {} },
    meta: {
      requestId: `req_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  }, status);
}
