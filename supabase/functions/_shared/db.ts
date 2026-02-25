import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export function parseQueryParams(url: URL) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50'), 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
  const order = url.searchParams.get('order') === 'desc' ? false : true; // true = ascending
  const sort = url.searchParams.get('sort') || 'name';
  const search = url.searchParams.get('search') || '';
  return { limit, offset, order, sort, search };
}
