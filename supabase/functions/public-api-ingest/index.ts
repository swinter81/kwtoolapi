import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/db.ts';

const VALID_RESOURCES = ['manufacturers', 'products', 'application_programs', 'dpts'] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only POST and PUT allowed
    if (req.method !== 'POST' && req.method !== 'PUT') {
      return errorResponse('METHOD_NOT_ALLOWED', 'Only POST and PUT methods are allowed.', 405);
    }

    // Validate secret
    const secret = req.headers.get('X-API-Secret');
    const expectedSecret = Deno.env.get('INGEST_API_SECRET');
    if (!secret || secret !== expectedSecret) {
      return errorResponse('UNAUTHORIZED', 'Invalid or missing X-API-Secret header.', 401);
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Path: /public-api-ingest/{resource}
    const resource = pathParts[1] || null;

    if (!resource || !VALID_RESOURCES.includes(resource as any)) {
      return errorResponse('BAD_REQUEST', `Invalid resource. Must be one of: ${VALID_RESOURCES.join(', ')}`, 400);
    }

    const body = await req.json();

    // Accept single object or array
    const records: any[] = Array.isArray(body) ? body : [body];
    if (records.length === 0) {
      return errorResponse('BAD_REQUEST', 'Request body must contain at least one record.', 400);
    }
    if (records.length > 100) {
      return errorResponse('BAD_REQUEST', 'Maximum 100 records per request.', 400);
    }

    const db = getServiceClient();

    // Validate and transform based on resource type
    let dbRecords: any[];
    let conflictColumn: string;

    switch (resource) {
      case 'manufacturers':
        conflictColumn = 'knx_manufacturer_id';
        dbRecords = records.map(r => {
          if (!r.knxManufacturerId || !r.hexCode) {
            throw new Error('Each manufacturer must have knxManufacturerId and hexCode.');
          }
          return {
            id: r.id || crypto.randomUUID(),
            knx_manufacturer_id: r.knxManufacturerId,
            hex_code: r.hexCode,
            name: r.name || null,
            short_name: r.shortName || null,
            country: r.country || null,
            website_url: r.websiteUrl || null,
            product_count: r.productCount ?? 0,
            application_program_count: r.applicationProgramCount ?? 0,
            status: r.status || 'approved',
          };
        });
        break;

      case 'products':
        conflictColumn = 'knx_product_id';
        dbRecords = records.map(r => {
          if (!r.knxProductId) {
            throw new Error('Each product must have knxProductId.');
          }
          return {
            id: r.id || crypto.randomUUID(),
            knx_product_id: r.knxProductId,
            knx_hardware_id: r.knxHardwareId || null,
            manufacturer_id: r.manufacturerId || null,
            name: r.name || null,
            order_number: r.orderNumber || null,
            description: r.description || null,
            medium_types: r.mediumTypes || null,
            bus_current_ma: r.busCurrent ?? null,
            is_coupler: r.isCoupler ?? false,
            is_ip_device: r.isIpDevice ?? false,
            is_power_supply: r.isPowerSupply ?? false,
            status: r.status || 'approved',
          };
        });
        break;

      case 'application_programs':
        conflictColumn = 'knx_application_id';
        dbRecords = records.map(r => {
          if (!r.knxApplicationId) {
            throw new Error('Each application program must have knxApplicationId.');
          }
          return {
            id: r.id || crypto.randomUUID(),
            knx_application_id: r.knxApplicationId,
            knx_program_id: r.knxProgramId || null,
            name: r.name || null,
            version: r.version || null,
            application_number: r.applicationNumber || null,
            manufacturer_id: r.manufacturerId || null,
            product_id: r.productId || null,
            communication_object_count: r.communicationObjectCount ?? null,
            max_group_address_links: r.maxGroupAddressLinks ?? null,
            status: r.status || 'approved',
          };
        });
        break;

      case 'dpts':
        conflictColumn = 'dpt_id';
        dbRecords = records.map(r => {
          if (!r.dptId || !r.number || !r.name) {
            throw new Error('Each DPT must have dptId, number, and name.');
          }
          return {
            id: r.id || crypto.randomUUID(),
            dpt_id: r.dptId,
            number: r.number,
            main_number: r.mainNumber,
            sub_number: r.subNumber,
            name: r.name,
            description: r.description || null,
            size_bits: r.sizeBits ?? null,
            unit: r.unit || null,
            range_low: r.rangeLow || null,
            range_high: r.rangeHigh || null,
            encoding_description: r.encodingDescription || null,
          };
        });
        break;

      default:
        return errorResponse('BAD_REQUEST', 'Invalid resource.', 400);
    }

    // Upsert: insert or update on conflict
    const { data, error } = await db
      .from(resource)
      .upsert(dbRecords, { onConflict: conflictColumn })
      .select();

    if (error) {
      console.error('Upsert error:', error);
      return errorResponse('DB_ERROR', error.message, 500);
    }

    return successResponse({
      resource,
      action: 'upsert',
      count: data?.length || 0,
      records: data,
    });
  } catch (e: any) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', e.message || 'Internal server error', 500);
  }
});
