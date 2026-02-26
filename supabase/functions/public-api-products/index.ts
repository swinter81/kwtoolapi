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
    const productId = pathParts[1] || null;
    const subResource = pathParts[2] || null;
    const db = getServiceClient();

    if (productId && subResource === 'application-programs') {
      const { limit, offset } = parseQueryParams(url);
      let prodId = productId;
      if (productId.includes('_H-')) {
        const { data: prod } = await db.from('community_products').select('id').eq('knx_product_id', productId).single();
        if (!prod) return errorResponse('NOT_FOUND', `Product '${productId}' not found.`, 404);
        prodId = prod.id;
      }
      // Note: there's no community_application_programs view, so skip this sub-resource
      return listResponse([], { total: 0, limit, offset }, 3600);
    }

    if (productId) {
      let query = db.from('community_products').select('*');
      if (productId.includes('_H-')) {
        query = query.eq('knx_product_id', productId);
      } else {
        query = query.eq('id', productId);
      }
      const { data, error } = await query.single();
      if (error || !data) return errorResponse('NOT_FOUND', `Product '${productId}' not found.`, 404);

      // Lookup manufacturer
      let mfr = null;
      if (data.manufacturer_id) {
        const { data: m } = await db.from('community_manufacturers').select('*').eq('id', data.manufacturer_id).single();
        mfr = m;
      }

      return successResponse({
        ...formatProductDetail(data, mfr),
      }, undefined, 3600);
    }

    // GET /products
    const { limit, offset, order, sort, search } = parseQueryParams(url);
    const manufacturerId = url.searchParams.get('manufacturerId') || '';
    const orderNumber = url.searchParams.get('orderNumber') || '';
    const mediumType = url.searchParams.get('mediumType') || '';
    const category = url.searchParams.get('category') || '';
    const isCoupler = url.searchParams.get('isCoupler');
    const isIpDevice = url.searchParams.get('isIpDevice');

    let query = db.from('community_products').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,order_number.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (manufacturerId) {
      if (manufacturerId.startsWith('M-')) {
        const { data: mfr } = await db.from('community_manufacturers').select('id').eq('knx_manufacturer_id', manufacturerId).single();
        if (mfr) query = query.eq('manufacturer_id', mfr.id);
      } else {
        query = query.eq('manufacturer_id', manufacturerId);
      }
    }
    if (orderNumber) query = query.ilike('order_number', `%${orderNumber}%`);
    if (mediumType) query = query.contains('medium_types', [mediumType]);
    if (category) query = query.eq('category', category);
    if (isCoupler !== null && isCoupler !== undefined && isCoupler !== '') query = query.eq('is_coupler', isCoupler === 'true');
    if (isIpDevice !== null && isIpDevice !== undefined && isIpDevice !== '') query = query.eq('is_ip_device', isIpDevice === 'true');

    const sortCol = sort === 'orderNumber' ? 'order_number' : sort === 'manufacturer' ? 'manufacturer_id' : 'name';
    const { data, count, error } = await query.range(offset, offset + limit - 1).order(sortCol, { ascending: order });
    if (error) throw error;

    // Batch lookup manufacturers
    const mfrIds = [...new Set((data || []).map((r: any) => r.manufacturer_id).filter(Boolean))];
    let mfrMap: Record<string, any> = {};
    if (mfrIds.length > 0) {
      const { data: mfrs } = await db.from('community_manufacturers').select('id, knx_manufacturer_id, short_name').in('id', mfrIds);
      for (const m of mfrs || []) mfrMap[m.id] = m;
    }

    return listResponse((data || []).map((r: any) => formatProductList(r, mfrMap[r.manufacturer_id])), { total: count || 0, limit, offset }, 3600);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});

function formatProductList(row: any, mfr: any) {
  return {
    id: row.id,
    knxProductId: row.knx_product_id,
    name: row.name,
    orderNumber: row.order_number,
    description: row.description,
    manufacturer: mfr ? { id: mfr.id, knxManufacturerId: mfr.knx_manufacturer_id, shortName: mfr.short_name } : null,
    mediumTypes: row.medium_types,
    category: row.category,
    busCurrent: row.bus_current_ma,
    isCoupler: row.is_coupler,
    isIpDevice: row.is_ip_device,
    isPowerSupply: row.is_power_supply,
    lastUpdated: row.updated_at,
  };
}

function formatProductDetail(row: any, mfr: any) {
  return {
    id: row.id,
    knxProductId: row.knx_product_id,
    knxHardwareId: row.knx_hardware_id,
    name: row.name,
    orderNumber: row.order_number,
    description: row.description,
    manufacturer: mfr ? {
      id: mfr.id, knxManufacturerId: mfr.knx_manufacturer_id, hexCode: mfr.hex_code,
      name: mfr.name, shortName: mfr.short_name,
    } : null,
    mediumTypes: row.medium_types,
    category: row.category,
    specifications: row.specifications,
    imageUrl: row.image_url,
    busCurrent: row.bus_current_ma,
    isCoupler: row.is_coupler,
    isIpDevice: row.is_ip_device,
    isPowerSupply: row.is_power_supply,
    documents: {
      href: `/v1/documents?manufacturerId=${row.manufacturer_id}`,
    },
    lastUpdated: row.updated_at,
  };
}
