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
    const dptNumber = pathParts[1] || null;
    const db = getServiceClient();

    if (dptNumber) {
      // Could be "1.001" or "DPST-1-1"
      let query = db.from('dpts').select('*');
      if (dptNumber.startsWith('DPST')) {
        query = query.eq('dpt_id', dptNumber);
      } else {
        query = query.eq('number', dptNumber);
      }
      const { data, error } = await query.single();
      if (error || !data) return errorResponse('NOT_FOUND', `DPT '${dptNumber}' not found.`, 404);
      return successResponse(formatDpt(data), undefined, 86400);
    }

    const { limit, offset, search } = parseQueryParams(url);
    const mainNumber = url.searchParams.get('mainNumber');

    let query = db.from('dpts').select('*', { count: 'exact' });
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,number.ilike.%${search}%`);
    }
    if (mainNumber) {
      query = query.eq('main_number', parseInt(mainNumber));
    }
    const { data, count, error } = await query.range(offset, offset + limit - 1).order('main_number').order('sub_number');
    if (error) throw error;

    return listResponse((data || []).map(formatDpt), { total: count || 0, limit, offset }, 86400);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});

function formatDpt(row: any) {
  return {
    id: row.id,
    dptId: row.dpt_id,
    number: row.number,
    mainNumber: row.main_number,
    subNumber: row.sub_number,
    name: row.name,
    description: row.description,
    sizeBits: row.size_bits,
    unit: row.unit,
    range: row.range_low || row.range_high ? { low: row.range_low, high: row.range_high } : null,
    encodingDescription: row.encoding_description,
  };
}
