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
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const knxId = decodeURIComponent(pathParts[1] || '');
    const autoDiscover = url.searchParams.get('autoDiscover') !== 'false'; // default true

    if (req.method === 'POST' && !pathParts[1]) {
      // Batch resolve
      const body = await req.json();
      const knxIds: string[] = body.knxIds || [];
      const batchAutoDiscover = body.autoDiscover !== false;
      if (!knxIds.length || knxIds.length > 200) {
        return errorResponse('BAD_REQUEST', 'knxIds must contain 1-200 items.', 400);
      }

      const resolved: Record<string, any> = {};
      const unresolved: any[] = [];
      const discovering: any[] = [];

      for (const id of knxIds) {
        const result = await smartResolve(db, id);
        if (result.resolved) {
          resolved[id] = result;
        } else if (batchAutoDiscover && result.manufacturer) {
          // Trigger auto-discovery in background
          discovering.push({ knxId: id, segments: result.segments });
          triggerAutoDiscovery(result.segments).catch(() => {});
          resolved[id] = { ...result, status: 'discovering', message: 'Product not found. Auto-discovery triggered. Try again in 1-2 minutes.' };
        } else {
          unresolved.push({ knxId: id, segments: result.segments, reason: 'Unknown ID' });
        }
      }

      return successResponse({
        resolved,
        unresolved,
        discovering,
        stats: { total: knxIds.length, resolvedCount: Object.keys(resolved).length, unresolvedCount: unresolved.length, discoveringCount: discovering.length },
      });
    }

    if (req.method === 'GET' && knxId) {
      const result = await smartResolve(db, knxId);
      
      if (result.resolved) {
        return successResponse(result, undefined, 3600);
      }

      // Not found — trigger auto-discovery if enabled
      if (autoDiscover && result.segments.manufacturerId) {
        triggerAutoDiscovery(result.segments).catch(() => {});
        return successResponse({
          ...result,
          status: 'discovering',
          message: 'Product not found in database. Auto-discovery has been triggered. The system will search for the product datasheet, download it, and extract all KNX data. Try again in 1-2 minutes.',
          retryAfter: 120,
        });
      }

      return successResponse(result);
    }

    return errorResponse('BAD_REQUEST', 'Invalid request', 400);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});

// Parse ANY KNX ID format into segments
function parseKnxId(knxId: string) {
  const segments: any = {
    raw: knxId,
    manufacturerId: null,
    manufacturerHex: null,
    hardwareId: null,
    orderHint: null,
    programId: null,
    programVersion: null,
  };

  // Extract manufacturer: M-XXXX
  const mfrMatch = knxId.match(/^(M-[0-9A-Fa-f]{4})/);
  if (mfrMatch) {
    segments.manufacturerId = mfrMatch[1];
    segments.manufacturerHex = mfrMatch[1].replace('M-', '');
  }

  // Extract hardware ID: H-... (everything between H- and the next _P- or _O or end)
  const hwMatch = knxId.match(/_H-([^_]+?)(?=_P-|_O|$)/);
  if (hwMatch) {
    segments.hardwareId = 'H-' + hwMatch[1];
    
    // Try to extract order hint from hardware ID
    const hwParts = hwMatch[1].split('.');
    if (hwParts.length >= 1) {
      segments.orderHint = hwParts[0].replace(/^0+/, ''); // Remove leading zeros
    }
  }

  // Extract order reference: O followed by hex digits
  const orderMatch = knxId.match(/O([0-9A-Fa-f]{4})/);
  if (orderMatch) {
    segments.orderRef = orderMatch[1];
  }

  // Extract program ID: P-XXXX.XXXX
  const progMatch = knxId.match(/_P-([0-9A-Fa-f.]+)/);
  if (progMatch) {
    segments.programId = 'P-' + progMatch[1];
    const progParts = progMatch[1].split('.');
    if (progParts.length >= 2) {
      segments.programVersion = progParts[progParts.length - 1];
    }
  }

  return segments;
}

async function smartResolve(db: any, knxId: string) {
  const segments = parseKnxId(knxId);
  const base = { knxId, segments, resolved: false, manufacturer: null, product: null, applicationProgram: null, communicationObjects: null, parameters: null, specifications: null };

  // 1. Resolve manufacturer
  if (segments.manufacturerId) {
    const { data: mfr } = await db.from('community_manufacturers')
      .select('*').eq('knx_manufacturer_id', segments.manufacturerId).single();
    if (mfr) {
      base.manufacturer = {
        id: mfr.id, knxManufacturerId: mfr.knx_manufacturer_id,
        hexCode: mfr.hex_code, name: mfr.name, shortName: mfr.short_name,
      };
    }
  }

  // 2. Try exact match on knx_product_id
  const fullProductId = segments.manufacturerId && segments.hardwareId
    ? `${segments.manufacturerId}_${segments.hardwareId}` : null;
  
  if (fullProductId) {
    const { data: prod } = await db.from('community_products')
      .select('*').eq('knx_product_id', fullProductId).single();
    if (prod) {
      return await enrichProductResult(db, base, prod);
    }
  }

  // 3. Try partial matching on hardware ID parts
  if (segments.orderHint && base.manufacturer) {
    const { data: products } = await db.from('community_products')
      .select('*')
      .eq('manufacturer_id', (base.manufacturer as any).id)
      .or(`order_number.ilike.%${segments.orderHint}%,name.ilike.%${segments.orderHint}%`);
    
    if (products && products.length === 1) {
      return await enrichProductResult(db, base, products[0]);
    }
    
    if (products && products.length > 1) {
      return await enrichProductResult(db, base, products[0]);
    }
  }

  // 4. Try searching with hardware ID segments
  if (segments.hardwareId && base.manufacturer) {
    const numericParts = segments.hardwareId.match(/\d{3,}/g) || [];
    for (const part of numericParts) {
      const { data: products } = await db.from('community_products')
        .select('*')
        .eq('manufacturer_id', (base.manufacturer as any).id)
        .or(`order_number.ilike.%${part}%,name.ilike.%${part}%`);
      
      if (products && products.length > 0) {
        return await enrichProductResult(db, base, products[0]);
      }
    }
  }

  // 5. Not found
  return base;
}

async function enrichProductResult(db: any, base: any, product: any) {
  const { count: commObjCount } = await db.from('community_communication_objects')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', product.id);

  const { count: paramCount } = await db.from('community_parameters')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', product.id);

  const { count: specCount } = await db.from('community_technical_specifications')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', product.id);

  return {
    ...base,
    resolved: true,
    product: {
      id: product.id,
      knxProductId: product.knx_product_id,
      name: product.name,
      orderNumber: product.order_number,
      description: product.description,
      mediumTypes: product.medium_types,
      category: product.category,
      specifications: product.specifications,
    },
    communicationObjects: {
      count: commObjCount || 0,
      href: `/v1/products/${product.id}/communication-objects`,
    },
    parameters: {
      count: paramCount || 0,
      href: `/v1/products/${product.id}/parameters`,
    },
    specifications: {
      count: specCount || 0,
      href: `/v1/products/${product.id}/specifications`,
    },
  };
}

// Trigger auto-discovery via the extract-knx-data Edge Function
async function triggerAutoDiscovery(segments: any) {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const CRAWLER_KEY = Deno.env.get('CRAWLER_SERVICE_KEY')!;
  const SERPER_KEY = Deno.env.get('SERPER_API_KEY');

  if (!segments.manufacturerId) return;

  const searchTerms = [
    segments.orderHint,
    segments.hardwareId?.replace('H-', '').replace(/\./g, ' '),
  ].filter(Boolean);

  if (!searchTerms.length) return;

  const mfrToSource: Record<string, string> = {
    'M-0008': 'gira', 'M-00C8': 'mdt', 'M-0083': 'jung',
    'M-0001': 'siemens', 'M-0004': 'abb', 'M-0066': 'schneider',
    'M-0025': 'hager', 'M-0042': 'theben', 'M-0064': 'weinzierl',
  };
  const sourceId = mfrToSource[segments.manufacturerId] || 'unknown';

  if (SERPER_KEY) {
    for (const term of searchTerms) {
      try {
        const searchResponse = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: `${term} KNX datasheet filetype:pdf`,
            num: 3,
            gl: 'de',
          }),
        });

        const searchData = await searchResponse.json();
        const pdfUrls = (searchData.organic || [])
          .map((r: any) => r.link)
          .filter((url: string) => url?.toLowerCase().includes('.pdf'))
          .slice(0, 2);

        for (const pdfUrl of pdfUrls) {
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/extract-knx-data`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${CRAWLER_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                pdf_url: pdfUrl,
                product_name: term,
                order_number: segments.orderHint || term,
                manufacturer: sourceId,
                category: 'unknown',
              }),
            });
          } catch (e) {}
        }
      } catch (e) {}
    }
  }
}
