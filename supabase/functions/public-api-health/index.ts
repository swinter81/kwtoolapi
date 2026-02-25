import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const startTime = Date.now();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    status: 'ok',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
