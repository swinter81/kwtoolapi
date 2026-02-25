import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/db.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = getServiceClient();

    const [mfrTotal, mfrWithProducts, prodTotal, appTotal, lastMfr] = await Promise.all([
      db.from('manufacturers').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      db.from('manufacturers').select('id', { count: 'exact', head: true }).eq('status', 'approved').gt('product_count', 0),
      db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      db.from('application_programs').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      db.from('manufacturers').select('updated_at').eq('status', 'approved').order('updated_at', { ascending: false }).limit(1),
    ]);

    // Count by medium type
    const { data: tpProducts } = await db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'approved').contains('medium_types', ['TP']);
    const { data: ipProducts, count: ipCount } = await db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'approved').contains('medium_types', ['IP']);
    const { data: rfProducts, count: rfCount } = await db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'approved').contains('medium_types', ['RF']);

    const lastUpdated = lastMfr.data?.[0]?.updated_at || new Date().toISOString();

    return successResponse({
      manufacturers: { total: mfrTotal.count || 0, withProducts: mfrWithProducts.count || 0 },
      products: {
        total: prodTotal.count || 0,
        byMediumType: { TP: tpProducts?.length || prodTotal.count || 0, IP: ipCount || 0, RF: rfCount || 0 },
      },
      applicationPrograms: { total: appTotal.count || 0 },
      lastUpdated,
      dataVersion: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    }, undefined, 300);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});
