import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/db.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
const CRAWLER_SERVICE_KEY = Deno.env.get('CRAWLER_SERVICE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = getServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const knxId = decodeURIComponent(pathParts[1] || '');
    const autoDiscover = url.searchParams.get('autoDiscover') !== 'false';

    // POST = batch resolve
    if (req.method === 'POST' && !pathParts[1]) {
      const body = await req.json();
      const knxIds: string[] = body.knxIds || [];
      const batchAutoDiscover = body.autoDiscover !== false;
      if (!knxIds.length || knxIds.length > 200) {
        return errorResponse('BAD_REQUEST', 'knxIds must contain 1-200 items.', 400);
      }

      const resolved: Record<string, any> = {};
      const unresolved: any[] = [];

      for (const id of knxIds) {
        const result = await fullResolve(db, id, batchAutoDiscover);
        if (result.resolved) {
          resolved[id] = result;
        } else {
          unresolved.push({ knxId: id, segments: result.segments, status: result.status || 'not_found' });
        }
      }

      return successResponse({
        resolved, unresolved,
        stats: { total: knxIds.length, resolvedCount: Object.keys(resolved).length, unresolvedCount: unresolved.length },
      });
    }

    // GET = single resolve
    if (req.method === 'GET' && knxId) {
      const result = await fullResolve(db, knxId, autoDiscover);
      return successResponse(result, undefined, result.resolved ? 3600 : 0);
    }

    return errorResponse('BAD_REQUEST', 'Invalid request. Use GET /resolve/{knxId} or POST /resolve with { knxIds: [...] }', 400);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});

// ─── PARSE KNX ID ──────────────────────────────────────────

function parseKnxId(knxId: string) {
  const segments: any = {
    raw: knxId,
    manufacturerId: null,
    manufacturerHex: null,
    hardwareId: null,
    orderRef: null,
    programId: null,
    programNumber: null,
    programVersion: null,
    searchTerms: [],
  };

  // M-XXXX
  const mfrMatch = knxId.match(/^(M-[0-9A-Fa-f]{4})/);
  if (mfrMatch) {
    segments.manufacturerId = mfrMatch[1];
    segments.manufacturerHex = mfrMatch[1].replace('M-', '').toUpperCase();
  }

  // H-... (hardware ID)
  const hwMatch = knxId.match(/_H-(.+?)(?=_P-|$)/);
  if (hwMatch) {
    segments.hardwareId = hwMatch[1];
  }

  // O followed by hex (order reference)
  const orderMatch = knxId.match(/-O([0-9A-Fa-f]{4,})/);
  if (orderMatch) {
    segments.orderRef = orderMatch[1];
  }

  // P-XXXX.XXXX (program ID)
  const progMatch = knxId.match(/_P-([0-9A-Fa-f.]+)/);
  if (progMatch) {
    segments.programId = progMatch[1];
    const progParts = progMatch[1].split('.');
    segments.programNumber = progParts[0];
    if (progParts.length >= 2) segments.programVersion = progParts.slice(1).join('.');
  }

  // Build search terms (most specific first)
  
  // 1. Program number — for many manufacturers this IS the order number
  if (segments.programNumber && segments.programNumber.length >= 3) {
    segments.searchTerms.push(segments.programNumber);
    // Try with common suffixes: "1038 00", "1038 .."
    segments.searchTerms.push(segments.programNumber + ' 00');
  }

  // 2. Long numeric sequences from hardware ID
  if (segments.hardwareId) {
    const longNums = segments.hardwareId.match(/\d{4,}/g) || [];
    for (const num of longNums) {
      if (!segments.searchTerms.includes(num)) segments.searchTerms.push(num);
    }
  }

  // 3. Alphanumeric patterns (order number-like)
  if (segments.hardwareId) {
    const patterns = segments.hardwareId.match(/[A-Z]{2,}[-.]?\d{3,}/gi) || [];
    for (const p of patterns) {
      if (!segments.searchTerms.includes(p)) segments.searchTerms.push(p);
    }
  }

  // 4. Order reference
  if (segments.orderRef) {
    segments.searchTerms.push(segments.orderRef);
  }

  return segments;
}

// ─── FULL RESOLVE PIPELINE ─────────────────────────────────

async function fullResolve(db: any, knxId: string, autoDiscover: boolean) {
  const segments = parseKnxId(knxId);
  const base: any = {
    knxId, segments, resolved: false,
    manufacturer: null, product: null,
    communicationObjects: null, parameters: null, specifications: null,
  };

  // Step 1: Resolve manufacturer
  if (segments.manufacturerId) {
    const { data: mfr } = await db.from('community_manufacturers')
      .select('*').eq('knx_manufacturer_id', segments.manufacturerId).single();
    if (mfr) {
      base.manufacturer = {
        id: mfr.id, knxManufacturerId: mfr.knx_manufacturer_id,
        name: mfr.name, shortName: mfr.short_name,
      };
    }
  }

  if (!base.manufacturer) {
    return { ...base, status: 'unknown_manufacturer' };
  }

  // Step 2: Database lookup — try multiple strategies
  const product = await databaseLookup(db, base.manufacturer, segments);
  if (product) {
    return await enrichResult(db, base, product);
  }

  // Step 3: Claude interpretation — ask Claude what this product is
  if (ANTHROPIC_API_KEY) {
    const claudeResult = await claudeInterpret(db, base.manufacturer, segments);
    if (claudeResult) {
      // Claude identified a product name and order number — search for it
      const product = await searchByClaudeHint(db, base.manufacturer, claudeResult);
      if (product) {
        return await enrichResult(db, base, product);
      }
      
      // Auto-create the product from Claude's identification
      if (claudeResult.orderNumber && claudeResult.confidence >= 0.7) {
        try {
          const newId = 'prod_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
          const { error } = await db.from('community_products').insert({
            id: newId,
            name: claudeResult.productName,
            order_number: claudeResult.orderNumber,
            manufacturer_id: base.manufacturer.id,
            category: claudeResult.category || 'other',
            description: claudeResult.description,
            medium_types: ['TP'],
            status: 'approved',
          });

          if (!error) {
            const { data: newProduct } = await db.from('community_products')
              .select('*').eq('id', newId).single();
            if (newProduct) {
              const allTerms = [...(claudeResult.searchTerms || []), claudeResult.orderNumber, ...segments.searchTerms].filter(Boolean);
              triggerAutoDiscovery(base.manufacturer, segments, allTerms).catch(() => {});
              return await enrichResult(db, base, newProduct);
            }
          }
        } catch (e) {
          console.error('Auto-create failed:', e);
        }
      }

      base.claudeInterpretation = claudeResult;
    }
  }

  // Step 4: Auto-discovery — search for PDFs and extract data
  if (autoDiscover) {
    const discoveryTerms = base.claudeInterpretation
      ? [base.claudeInterpretation.orderNumber, base.claudeInterpretation.productName, ...segments.searchTerms]
      : segments.searchTerms;
    
    triggerAutoDiscovery(base.manufacturer, segments, discoveryTerms.filter(Boolean)).catch(() => {});
    
    return {
      ...base,
      status: 'discovering',
      message: base.claudeInterpretation
        ? `Product identified as "${base.claudeInterpretation.productName}" (${base.claudeInterpretation.orderNumber}) but not yet in database. Auto-discovery triggered. Retry in 2 minutes.`
        : 'Product not found. Auto-discovery triggered. Retry in 2 minutes.',
      retryAfter: 120,
    };
  }

  return { ...base, status: 'not_found' };
}

// ─── DATABASE LOOKUP ───────────────────────────────────────

async function databaseLookup(db: any, manufacturer: any, segments: any) {
  // Strategy 1: Program number as order number (works for Gira, many others)
  if (segments.programNumber) {
    // Try exact: "1038 00"
    const { data: p1 } = await db.from('community_products')
      .select('*').eq('manufacturer_id', manufacturer.id)
      .ilike('order_number', `${segments.programNumber}%`).limit(1).single();
    if (p1) return p1;

    // Try contains
    const { data: p2 } = await db.from('community_products')
      .select('*').eq('manufacturer_id', manufacturer.id)
      .ilike('order_number', `%${segments.programNumber}%`).limit(5);
    if (p2?.length === 1) return p2[0];
    if (p2?.length > 1) {
      // Multiple matches — prefer exact start match
      const exact = p2.find((p: any) => p.order_number?.startsWith(segments.programNumber));
      if (exact) return exact;
      return p2[0]; // best guess
    }
  }

  // Strategy 2: All search terms against order_number and name
  for (const term of segments.searchTerms) {
    if (term.length < 3) continue;
    const { data } = await db.from('community_products')
      .select('*').eq('manufacturer_id', manufacturer.id)
      .or(`order_number.ilike.%${term}%,name.ilike.%${term}%`).limit(5);
    if (data?.length === 1) return data[0];
    if (data?.length > 1) {
      const exact = data.find((p: any) => p.order_number?.toLowerCase().includes(term.toLowerCase()));
      if (exact) return exact;
    }
  }

  // Strategy 3: Full knx_product_id match
  const fullId = segments.manufacturerId && segments.hardwareId
    ? `${segments.manufacturerId}_H-${segments.hardwareId}` : null;
  if (fullId) {
    const { data } = await db.from('community_products')
      .select('*').eq('knx_product_id', fullId).single();
    if (data) return data;
  }

  return null;
}

// ─── CLAUDE INTERPRETATION ─────────────────────────────────

async function claudeInterpret(db: any, manufacturer: any, segments: any) {
  if (!ANTHROPIC_API_KEY) return null;

  try {
    const prompt = `You are a KNX building automation expert. Identify this KNX product from its ETS identifier.

KNX ID: ${segments.raw}
Manufacturer: ${manufacturer.name} (${manufacturer.shortName}, ${manufacturer.knxManufacturerId})
Parsed segments:
- Hardware ID: ${segments.hardwareId || 'unknown'}
- Program Number: ${segments.programNumber || 'unknown'}
- Program Version: ${segments.programVersion || 'unknown'}
- Order Reference: ${segments.orderRef || 'none'}

Based on your knowledge of ${manufacturer.name} KNX products, identify:
1. The product name
2. The order number / article number
3. The product category
4. A brief description

Respond with ONLY valid JSON (no markdown):
{
  "productName": "Switching actuator 16fold/shutter actuator 8fold 16A",
  "orderNumber": "1038 00",
  "category": "switch actuator",
  "description": "Combined switching and shutter actuator, 16 switching channels or 8 shutter channels, 16A, DIN rail mounting",
  "confidence": 0.9,
  "searchTerms": ["1038 00", "switching actuator 16fold"]
}

If you cannot identify the product, respond with:
{"productName": null, "orderNumber": null, "confidence": 0}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    if (parsed.confidence < 0.5 || !parsed.productName) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

// ─── SEARCH BY CLAUDE HINT ────────────────────────────────

async function searchByClaudeHint(db: any, manufacturer: any, claudeResult: any) {
  // Try order number from Claude
  if (claudeResult.orderNumber) {
    const cleanOrder = claudeResult.orderNumber.replace(/\s+/g, '').replace(/\.\./g, '');
    
    const { data } = await db.from('community_products')
      .select('*').eq('manufacturer_id', manufacturer.id)
      .or(`order_number.ilike.%${cleanOrder}%,order_number.ilike.%${claudeResult.orderNumber}%`)
      .limit(1).single();
    if (data) return data;
  }

  // Try search terms from Claude
  for (const term of (claudeResult.searchTerms || [])) {
    if (!term || term.length < 3) continue;
    const { data } = await db.from('community_products')
      .select('*').eq('manufacturer_id', manufacturer.id)
      .or(`order_number.ilike.%${term}%,name.ilike.%${term}%`)
      .limit(1).single();
    if (data) return data;
  }

  return null;
}

// ─── AUTO-DISCOVERY ────────────────────────────────────────

async function triggerAutoDiscovery(manufacturer: any, segments: any, searchTerms: string[]) {
  console.log('triggerAutoDiscovery called', {
    hasSerperKey: !!SERPER_API_KEY,
    hasCrawlerKey: !!CRAWLER_SERVICE_KEY,
    manufacturer: manufacturer.shortName,
    searchTerms,
  });
  if (!SERPER_API_KEY || !CRAWLER_SERVICE_KEY) return;
  
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  
  const mfrDomains: Record<string, string> = {
    'Gira': 'gira.de', 'MDT': 'mdt.de', 'JUNG': 'jung.de',
    'Siemens': 'siemens.com', 'ABB': 'abb.com', 'Schneider Electric': 'se.com',
    'Hager': 'hager.com', 'Theben': 'theben.de', 'Weinzierl': 'weinzierl.de',
  };
  const mfrSources: Record<string, string> = {
    'Gira': 'gira', 'MDT': 'mdt', 'JUNG': 'jung', 'Siemens': 'siemens',
    'ABB': 'abb', 'Schneider Electric': 'schneider', 'Hager': 'hager',
    'Theben': 'theben', 'Weinzierl': 'weinzierl',
  };
  
  const domain = mfrDomains[manufacturer.shortName] || '';
  const sourceId = mfrSources[manufacturer.shortName] || 'unknown';

  // Build targeted search queries
  const queries: string[] = [];
  for (const term of searchTerms.slice(0, 3)) {
    if (domain) queries.push(`site:${domain} "${term}" KNX datasheet filetype:pdf`);
    queries.push(`${manufacturer.shortName} "${term}" KNX datasheet filetype:pdf`);
    queries.push(`${manufacturer.shortName} "${term}" KNX product datasheet filetype:pdf`);
  }

  const pdfUrls: string[] = [];
  
  for (const query of [...new Set(queries)].slice(0, 5)) {
    try {
      const resp = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: 5, gl: 'de', hl: 'en' }),
      });
      const data = await resp.json();
      const organicCount = (data.organic || []).length;
      const pdfFound: string[] = [];
      
      for (const r of (data.organic || [])) {
        if (r.link?.toLowerCase().endsWith('.pdf') && !pdfUrls.includes(r.link)) {
          pdfUrls.push(r.link);
          pdfFound.push(r.link);
        }
      }
      console.log('Serper search:', { query, organicResults: organicCount, pdfsFound: pdfFound.length, pdfUrls: pdfFound });
      await new Promise(r => setTimeout(r, 100));
      if (pdfUrls.length >= 3) break;
    } catch (e) { console.error('Serper search failed:', e); }
  }

  // Process top PDFs
  for (const pdfUrl of pdfUrls.slice(0, 2)) {
    try {
      const extractResp = await fetch(`${SUPABASE_URL}/functions/v1/extract-knx-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CRAWLER_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdf_url: pdfUrl,
          product_name: searchTerms[0] || 'Unknown',
          order_number: segments.programNumber || searchTerms[0] || '',
          manufacturer: sourceId,
          category: 'unknown',
        }),
      });
      console.log('extract-knx-data call:', { pdfUrl, status: extractResp.status });
    } catch (e) { console.error('extract-knx-data call failed:', { pdfUrl, error: e }); }
  }
}

// ─── ENRICH RESULT ─────────────────────────────────────────

async function enrichResult(db: any, base: any, product: any) {
  const { count: coCount } = await db.from('community_communication_objects')
    .select('id', { count: 'exact', head: true }).eq('product_id', product.id);
  const { count: paramCount } = await db.from('community_parameters')
    .select('id', { count: 'exact', head: true }).eq('product_id', product.id);
  const { count: specCount } = await db.from('community_technical_specifications')
    .select('id', { count: 'exact', head: true }).eq('product_id', product.id);

  return {
    ...base,
    resolved: true,
    product: {
      id: product.id,
      knxProductId: product.knx_product_id,
      name: product.name,
      orderNumber: product.order_number,
      description: product.description,
      category: product.category,
      mediumTypes: product.medium_types,
      specifications: product.specifications,
    },
    communicationObjects: {
      count: coCount || 0,
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
