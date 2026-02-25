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
      let query = db.from('application_programs')
        .select('*, manufacturers!manufacturer_id(id, knx_manufacturer_id, short_name, name, hex_code), products!product_id(id, knx_product_id, name, order_number)')
        .eq('status', 'approved');
      if (programId.includes('_A-')) {
        query = query.eq('knx_application_id', programId);
      } else {
        query = query.eq('id', programId);
      }
      const { data, error } = await query.single();
      if (error || !data) return errorResponse('NOT_FOUND', `Application program '${programId}' not found.`, 404);
      return successResponse(formatDetail(data), undefined, 3600);
    }

    // List
    const { limit, offset, order, sort, search } = parseQueryParams(url);
    const manufacturerId = url.searchParams.get('manufacturerId') || '';
    const productId = url.searchParams.get('productId') || '';
    const version = url.searchParams.get('version') || '';

    let query = db.from('application_programs')
      .select('*, manufacturers!manufacturer_id(id, knx_manufacturer_id, short_name), products!product_id(id, knx_product_id, name, order_number)', { count: 'exact' })
      .eq('status', 'approved');

    if (search) query = query.ilike('name', `%${search}%`);
    if (version) query = query.eq('version', version);
    if (manufacturerId) {
      if (manufacturerId.startsWith('M-')) {
        const { data: mfr } = await db.from('manufacturers').select('id').eq('knx_manufacturer_id', manufacturerId).single();
        if (mfr) query = query.eq('manufacturer_id', mfr.id);
      } else {
        query = query.eq('manufacturer_id', manufacturerId);
      }
    }
    if (productId) {
      if (productId.includes('_H-')) {
        const { data: prod } = await db.from('products').select('id').eq('knx_product_id', productId).single();
        if (prod) query = query.eq('product_id', prod.id);
      } else {
        query = query.eq('product_id', productId);
      }
    }

    const sortCol = sort === 'version' ? 'version' : sort === 'manufacturer' ? 'manufacturer_id' : 'name';
    const { data, count, error } = await query.range(offset, offset + limit - 1).order(sortCol, { ascending: order });
    if (error) throw error;

    return listResponse((data || []).map(formatList), { total: count || 0, limit, offset }, 3600);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});

function formatList(row: any) {
  return {
    id: row.id,
    knxApplicationId: row.knx_application_id,
    knxProgramId: row.knx_program_id,
    name: row.name,
    version: row.version,
    applicationNumber: row.application_number,
    manufacturer: row.manufacturers ? { id: row.manufacturers.id, knxManufacturerId: row.manufacturers.knx_manufacturer_id, shortName: row.manufacturers.short_name } : null,
    product: row.products ? { id: row.products.id, knxProductId: row.products.knx_product_id, name: row.products.name, orderNumber: row.products.order_number } : null,
    communicationObjectCount: row.communication_object_count,
    maxGroupAddressLinks: row.max_group_address_links,
    lastUpdated: row.updated_at,
  };
}

function formatDetail(row: any) {
  return {
    ...formatList(row),
    manufacturer: row.manufacturers ? {
      id: row.manufacturers.id, knxManufacturerId: row.manufacturers.knx_manufacturer_id,
      name: row.manufacturers.name, shortName: row.manufacturers.short_name,
    } : null,
  };
}
