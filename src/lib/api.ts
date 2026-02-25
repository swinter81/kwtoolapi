import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

async function callApi(functionName: string, path = '', params?: Record<string, string>) {
  const url = new URL(`${FUNCTIONS_URL}/${functionName}${path ? '/' + path : ''}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  return res.json();
}

async function callApiPost(functionName: string, body: unknown) {
  const res = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const api = {
  manufacturers: {
    list: (params?: Record<string, string>) => callApi('public-api-manufacturers', '', params),
    get: (id: string) => callApi('public-api-manufacturers', id),
    products: (id: string, params?: Record<string, string>) => callApi('public-api-manufacturers', `${id}/products`, params),
  },
  products: {
    list: (params?: Record<string, string>) => callApi('public-api-products', '', params),
    get: (id: string) => callApi('public-api-products', id),
  },
  programs: {
    list: (params?: Record<string, string>) => callApi('public-api-programs', '', params),
    get: (id: string) => callApi('public-api-programs', id),
  },
  resolve: {
    single: (knxId: string) => callApi('public-api-resolve', knxId),
    batch: (knxIds: string[]) => callApiPost('public-api-resolve', { knxIds }),
  },
  search: (params: Record<string, string>) => callApi('public-api-search', '', params),
  dpts: {
    list: (params?: Record<string, string>) => callApi('public-api-dpts', '', params),
    get: (number: string) => callApi('public-api-dpts', number),
  },
  stats: () => callApi('public-api-stats'),
  health: () => callApi('public-api-health'),
  ingest: (resource: string, body: unknown, secret: string) => {
    return fetch(`${FUNCTIONS_URL}/public-api-ingest/${resource}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'X-API-Secret': secret,
      },
      body: JSON.stringify(body),
    }).then(r => r.json());
  },
};
