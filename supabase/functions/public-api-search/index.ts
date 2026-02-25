import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/db.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    const types = (url.searchParams.get('types') || 'all').split(',').map(t => t.trim());
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20'), 1), 50);

    if (q.length < 2) {
      return errorResponse('BAD_REQUEST', 'Search query must be at least 2 characters.', 400);
    }

    const db = getServiceClient();
    const results: any[] = [];
    const searchAll = types.includes('all');

    if (searchAll || types.includes('manufacturer')) {
      const { data } = await db.from('manufacturers')
        .select('*').eq('status', 'approved')
        .or(`name.ilike.%${q}%,short_name.ilike.%${q}%,hex_code.ilike.%${q}%`)
        .limit(limit);
      for (const m of data || []) {
        const matchedFields: string[] = [];
        if (m.name?.toLowerCase().includes(q.toLowerCase())) matchedFields.push('name');
        if (m.short_name?.toLowerCase().includes(q.toLowerCase())) matchedFields.push('shortName');
        if (m.hex_code?.toLowerCase().includes(q.toLowerCase())) matchedFields.push('hexCode');
        results.push({
          type: 'manufacturer', score: matchedFields.length > 1 ? 0.95 : 0.8, matchedFields,
          item: { id: m.id, knxManufacturerId: m.knx_manufacturer_id, name: m.name, shortName: m.short_name, hexCode: m.hex_code },
        });
      }
    }

    if (searchAll || types.includes('product')) {
      const { data } = await db.from('products')
        .select('*, manufacturers!manufacturer_id(short_name)').eq('status', 'approved')
        .or(`name.ilike.%${q}%,order_number.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(limit);
      for (const p of data || []) {
        const matchedFields: string[] = [];
        if (p.name?.toLowerCase().includes(q.toLowerCase())) matchedFields.push('name');
        if (p.order_number?.toLowerCase().includes(q.toLowerCase())) matchedFields.push('orderNumber');
        if (p.description?.toLowerCase().includes(q.toLowerCase())) matchedFields.push('description');
        results.push({
          type: 'product', score: matchedFields.includes('orderNumber') ? 0.98 : 0.8, matchedFields,
          item: { id: p.id, knxProductId: p.knx_product_id, name: p.name, orderNumber: p.order_number, manufacturer: { shortName: p.manufacturers?.short_name } },
        });
      }
    }

    if (searchAll || types.includes('application_program')) {
      const { data } = await db.from('application_programs')
        .select('*, manufacturers!manufacturer_id(short_name)').eq('status', 'approved')
        .ilike('name', `%${q}%`).limit(limit);
      for (const a of data || []) {
        results.push({
          type: 'application_program', score: 0.8, matchedFields: ['name'],
          item: { id: a.id, knxApplicationId: a.knx_application_id, name: a.name, version: a.version, manufacturer: { shortName: a.manufacturers?.short_name } },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return successResponse({ results, totalResults: results.length }, undefined, 900);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});
