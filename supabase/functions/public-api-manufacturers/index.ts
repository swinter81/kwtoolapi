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
    const manufacturerId = pathParts[1] || null;
    const subResource = pathParts[2] || null;
    const db = getServiceClient();

    if (manufacturerId && subResource === 'products') {
      const { limit, offset, search } = parseQueryParams(url);
      let mfrId = manufacturerId;
      if (manufacturerId.startsWith('M-')) {
        const { data: mfr } = await db.from('community_manufacturers').select('id').eq('knx_manufacturer_id', manufacturerId).single();
        if (!mfr) return errorResponse('NOT_FOUND', `Manufacturer '${manufacturerId}' not found.`, 404);
        mfrId = mfr.id;
      }

      let query = db.from('community_products').select('*', { count: 'exact' }).eq('manufacturer_id', mfrId);
      if (search) {
        query = query.or(`name.ilike.%${search}%,order_number.ilike.%${search}%,description.ilike.%${search}%`);
      }
      const { data, count, error } = await query.range(offset, offset + limit - 1).order('name');
      if (error) throw error;

      const products = (data || []).map(formatProduct);
      return listResponse(products, { total: count || 0, limit, offset }, 3600);
    }

    if (manufacturerId) {
      let query = db.from('community_manufacturers').select('*');
      if (manufacturerId.startsWith('M-')) {
        query = query.eq('knx_manufacturer_id', manufacturerId);
      } else {
        query = query.eq('id', manufacturerId);
      }
      const { data, error } = await query.single();
      if (error || !data) return errorResponse('NOT_FOUND', `Manufacturer '${manufacturerId}' not found.`, 404);
      
      return successResponse({
        ...formatManufacturer(data),
        products: { href: `/v1/products?manufacturerId=${data.id}`, count: data.product_count },
        applicationPrograms: { href: `/v1/application-programs?manufacturerId=${data.id}`, count: data.application_program_count },
      }, undefined, 3600);
    }

    // GET /manufacturers
    const { limit, offset, order, sort, search } = parseQueryParams(url);
    const hexCode = url.searchParams.get('hexCode') || '';

    let query = db.from('community_manufacturers').select('*', { count: 'exact' });
    if (search) {
      query = query.or(`name.ilike.%${search}%,short_name.ilike.%${search}%`);
    }
    if (hexCode) {
      query = query.eq('hex_code', hexCode);
    }

    const sortCol = sort === 'hexCode' ? 'hex_code' : sort === 'productCount' ? 'product_count' : 'name';
    const { data, count, error } = await query.range(offset, offset + limit - 1).order(sortCol, { ascending: order });
    if (error) throw error;

    return listResponse((data || []).map(formatManufacturer), { total: count || 0, limit, offset }, 3600);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});

function formatManufacturer(row: any) {
  return {
    id: row.id,
    knxManufacturerId: row.knx_manufacturer_id,
    hexCode: row.hex_code,
    name: row.name,
    shortName: row.short_name,
    country: row.country,
    websiteUrl: row.website_url,
    productCount: row.product_count,
    applicationProgramCount: row.application_program_count,
    lastUpdated: row.updated_at,
  };
}

function formatProduct(row: any) {
  return {
    id: row.id,
    knxProductId: row.knx_product_id,
    name: row.name,
    orderNumber: row.order_number,
    description: row.description,
    mediumTypes: row.medium_types,
    busCurrent: row.bus_current_ma,
    isCoupler: row.is_coupler,
    isIpDevice: row.is_ip_device,
    isPowerSupply: row.is_power_supply,
    lastUpdated: row.updated_at,
  };
}
