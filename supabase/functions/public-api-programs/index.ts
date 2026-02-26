import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, listResponse, errorResponse } from '../_shared/response.ts';
import { getServiceClient, parseQueryParams } from '../_shared/db.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const programId = pathParts[1] || null;
    const db = getServiceClient();

    if (programId) {
      let query = db.from('application_programs').select('*').eq('status', 'approved');
      if (programId.includes('_A-')) {
        query = query.eq('knx_application_id', programId);
      } else {
        query = query.eq('id', programId);
      }
      const { data, error } = await query.single();
      if (error || !data) return errorResponse('NOT_FOUND', `Application program '${programId}' not found.`, 404);

      // Lookup manufacturer and product
      let mfr = null;
      if (data.manufacturer_id) {
        const { data: m } = await db.from('community_manufacturers').select('id, knx_manufacturer_id, short_name, name, hex_code').eq('id', data.manufacturer_id).single();
        mfr = m;
      }
      let prod = null;
      if (data.product_id) {
        const { data: p } = await db.from('community_products').select('id, knx_product_id, name, order_number').eq('id', data.product_id).single();
        prod = p;
      }

      return successResponse(formatDetail(data, mfr, prod), undefined, 3600);
    }

    // List
    const { limit, offset, order, sort, search } = parseQueryParams(url);
    const manufacturerId = url.searchParams.get('manufacturerId') || '';
    const productId = url.searchParams.get('productId') || '';
    const version = url.searchParams.get('version') || '';

    let query = db.from('application_programs').select('*', { count: 'exact' }).eq('status', 'approved');

    if (search) query = query.ilike('name', `%${search}%`);
    if (version) query = query.eq('version', version);
    if (manufacturerId) {
      if (manufacturerId.startsWith('M-')) {
        const { data: mfr } = await db.from('community_manufacturers').select('id').eq('knx_manufacturer_id', manufacturerId).single();
        if (mfr) query = query.eq('manufacturer_id', mfr.id);
      } else {
        query = query.eq('manufacturer_id', manufacturerId);
      }
    }
    if (productId) {
      if (productId.includes('_H-')) {
        const { data: prod } = await db.from('community_products').select('id').eq('knx_product_id', productId).single();
        if (prod) query = query.eq('product_id', prod.id);
      } else {
        query = query.eq('product_id', productId);
      }
    }

    const sortCol = sort === 'version' ? 'version' : sort === 'manufacturer' ? 'manufacturer_id' : 'name';
    const { data, count, error } = await query.range(offset, offset + limit - 1).order(sortCol, { ascending: order });
    if (error) throw error;

    // Batch lookup manufacturers and products
    const mfrIds = [...new Set((data || []).map((r: any) => r.manufacturer_id).filter(Boolean))];
    const prodIds = [...new Set((data || []).map((r: any) => r.product_id).filter(Boolean))];
    let mfrMap: Record<string, any> = {};
    let prodMap: Record<string, any> = {};

    if (mfrIds.length > 0) {
      const { data: mfrs } = await db.from('community_manufacturers').select('id, knx_manufacturer_id, short_name').in('id', mfrIds);
      for (const m of mfrs || []) mfrMap[m.id] = m;
    }
    if (prodIds.length > 0) {
      const { data: prods } = await db.from('community_products').select('id, knx_product_id, name, order_number').in('id', prodIds);
      for (const p of prods || []) prodMap[p.id] = p;
    }

    return listResponse((data || []).map((r: any) => formatList(r, mfrMap[r.manufacturer_id], prodMap[r.product_id])), { total: count || 0, limit, offset }, 3600);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});

function formatList(row: any, mfr: any, prod: any) {
  return {
    id: row.id,
    knxApplicationId: row.knx_application_id,
    knxProgramId: row.knx_program_id,
    name: row.name,
    version: row.version,
    applicationNumber: row.application_number,
    manufacturer: mfr ? { id: mfr.id, knxManufacturerId: mfr.knx_manufacturer_id, shortName: mfr.short_name } : null,
    product: prod ? { id: prod.id, knxProductId: prod.knx_product_id, name: prod.name, orderNumber: prod.order_number } : null,
    communicationObjectCount: row.communication_object_count,
    maxGroupAddressLinks: row.max_group_address_links,
    lastUpdated: row.updated_at,
  };
}

function formatDetail(row: any, mfr: any, prod: any) {
  return {
    ...formatList(row, mfr, prod),
    manufacturer: mfr ? {
      id: mfr.id, knxManufacturerId: mfr.knx_manufacturer_id,
      name: mfr.name, shortName: mfr.short_name,
    } : null,
  };
}
