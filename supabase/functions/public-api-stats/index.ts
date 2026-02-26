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

    const [mfrTotal, mfrWithProducts, prodTotal, lastMfr] = await Promise.all([
      db.from('community_manufacturers').select('id', { count: 'exact', head: true }),
      db.from('community_manufacturers').select('id', { count: 'exact', head: true }).gt('product_count', 0),
      db.from('community_products').select('id', { count: 'exact', head: true }),
      db.from('community_manufacturers').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    ]);

    // Count by medium type
    const { data: tpProducts } = await db.from('community_products').select('id', { count: 'exact', head: true }).contains('medium_types', ['TP']);
    const { data: ipProducts, count: ipCount } = await db.from('community_products').select('id', { count: 'exact', head: true }).contains('medium_types', ['IP']);
    const { data: rfProducts, count: rfCount } = await db.from('community_products').select('id', { count: 'exact', head: true }).contains('medium_types', ['RF']);

    // Document stats
    const { count: docTotal } = await db
      .from('community_crawled_documents')
      .select('id', { count: 'exact', head: true });

    const { data: docTypes } = await db
      .from('community_crawled_documents')
      .select('document_type');

    const docByType: Record<string, number> = {};
    for (const d of (docTypes || [])) {
      const t = d.document_type || 'unknown';
      docByType[t] = (docByType[t] || 0) + 1;
    }

    // Product category breakdown
    const { data: categories } = await db
      .from('community_products')
      .select('category');

    const prodByCategory: Record<string, number> = {};
    for (const p of (categories || [])) {
      const c = p.category || 'uncategorized';
      prodByCategory[c] = (prodByCategory[c] || 0) + 1;
    }

    const lastUpdated = lastMfr.data?.[0]?.updated_at || new Date().toISOString();

    return successResponse({
      manufacturers: { total: mfrTotal.count || 0, withProducts: mfrWithProducts.count || 0 },
      products: {
        total: prodTotal.count || 0,
        byMediumType: { TP: tpProducts?.length || prodTotal.count || 0, IP: ipCount || 0, RF: rfCount || 0 },
        byCategory: prodByCategory,
      },
      documents: {
        total: docTotal || 0,
        byType: docByType,
      },
      lastUpdated,
      dataVersion: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    }, undefined, 300);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});
