import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse, jsonResponse } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/db.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = getServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const knxId = pathParts[1] || null;

    if (req.method === 'POST' && !knxId) {
      // Batch resolve
      const body = await req.json();
      const knxIds: string[] = body.knxIds || [];
      if (!knxIds.length || knxIds.length > 200) {
        return errorResponse('BAD_REQUEST', 'knxIds must contain 1-200 items.', 400);
      }

      const resolved: Record<string, any> = {};
      const unresolved: any[] = [];

      for (const id of knxIds) {
        const result = await resolveId(db, id);
        if (result.resolved) {
          resolved[id] = result;
        } else {
          unresolved.push({ knxId: id, type: result.type, reason: 'Unknown ID' });
        }
      }

      return successResponse({
        resolved,
        unresolved,
        stats: { total: knxIds.length, resolvedCount: Object.keys(resolved).length, unresolvedCount: unresolved.length },
      });
    }

    if (req.method === 'GET' && knxId) {
      const type = detectType(knxId);
      if (!type) return errorResponse('VALIDATION_ERROR', `Invalid KNX ID format: '${knxId}'`, 422);
      const result = await resolveId(db, knxId);
      return successResponse(result, undefined, 3600);
    }

    return errorResponse('BAD_REQUEST', 'Invalid request', 400);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});

function detectType(knxId: string): string | null {
  if (/^M-[0-9A-Fa-f]{4}_H-[0-9A-Fa-f]{4}\.HP-/.test(knxId)) return 'hardware_program_mapping';
  if (/^M-[0-9A-Fa-f]{4}_A-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{4}$/.test(knxId)) return 'application_program';
  if (/^M-[0-9A-Fa-f]{4}_H-[0-9A-Fa-f]{4}$/.test(knxId)) return 'product';
  if (/^M-[0-9A-Fa-f]{4}$/.test(knxId)) return 'manufacturer';
  return null;
}

async function resolveId(db: any, knxId: string) {
  const type = detectType(knxId);
  const base = { knxId, type, resolved: false, manufacturer: null, product: null, applicationProgram: null, hardwareProgramMapping: null };

  if (!type) return base;

  if (type === 'manufacturer') {
    const { data } = await db.from('manufacturers').select('*').eq('knx_manufacturer_id', knxId).eq('status', 'approved').single();
    if (!data) return base;
    return { ...base, resolved: true, manufacturer: { id: data.id, knxManufacturerId: data.knx_manufacturer_id, hexCode: data.hex_code, name: data.name, shortName: data.short_name } };
  }

  // Extract manufacturer ID
  const mfrCode = knxId.match(/^(M-[0-9A-Fa-f]{4})/)?.[1];
  const { data: mfr } = await db.from('manufacturers').select('*').eq('knx_manufacturer_id', mfrCode).eq('status', 'approved').single();
  const mfrSummary = mfr ? { id: mfr.id, knxManufacturerId: mfr.knx_manufacturer_id, hexCode: mfr.hex_code, name: mfr.name, shortName: mfr.short_name } : null;

  if (type === 'product') {
    const { data: prod } = await db.from('products').select('*').eq('knx_product_id', knxId).eq('status', 'approved').single();
    if (!prod) return { ...base, manufacturer: mfrSummary };
    return {
      ...base, resolved: true, manufacturer: mfrSummary,
      product: { id: prod.id, knxProductId: prod.knx_product_id, name: prod.name, orderNumber: prod.order_number, mediumTypes: prod.medium_types },
    };
  }

  if (type === 'application_program') {
    const { data: app } = await db.from('application_programs').select('*, products!product_id(id, knx_product_id, name, order_number, medium_types)').eq('knx_application_id', knxId).eq('status', 'approved').single();
    if (!app) return { ...base, manufacturer: mfrSummary };
    return {
      ...base, resolved: true, manufacturer: mfrSummary,
      product: app.products ? { id: app.products.id, knxProductId: app.products.knx_product_id, name: app.products.name, orderNumber: app.products.order_number, mediumTypes: app.products.medium_types } : null,
      applicationProgram: { id: app.id, knxApplicationId: app.knx_application_id, name: app.name, version: app.version, communicationObjectCount: app.communication_object_count },
    };
  }

  if (type === 'hardware_program_mapping') {
    const { data: hw } = await db.from('hardware_program_mappings').select('*, products!product_id(id, knx_product_id, name, order_number), application_programs!application_program_id(id, knx_application_id, name, version)').eq('knx_hw2prog_id', knxId).single();
    if (!hw) return { ...base, manufacturer: mfrSummary };
    return {
      ...base, resolved: true, manufacturer: mfrSummary,
      product: hw.products ? { id: hw.products.id, knxProductId: hw.products.knx_product_id, name: hw.products.name, orderNumber: hw.products.order_number } : null,
      applicationProgram: hw.application_programs ? { id: hw.application_programs.id, knxApplicationId: hw.application_programs.knx_application_id, name: hw.application_programs.name, version: hw.application_programs.version } : null,
      hardwareProgramMapping: { knxHw2ProgId: hw.knx_hw2prog_id },
    };
  }

  return base;
}
