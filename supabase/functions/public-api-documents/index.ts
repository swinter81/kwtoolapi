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
    const documentId = pathParts[1] || null;
    const subResource = pathParts[2] || null;
    const db = getServiceClient();

    // GET /documents/{id}/text — return full extracted text
    if (documentId && subResource === 'text') {
      const { data: chunks, error } = await db
        .from('community_crawled_document_chunks')
        .select('content, chunk_index, token_count')
        .eq('document_id', documentId)
        .order('chunk_index');
      
      if (error) throw error;
      if (!chunks || chunks.length === 0) {
        return errorResponse('NOT_FOUND', `No text found for document '${documentId}'.`, 404);
      }

      const fullText = chunks.map((c: any) => c.content).join(' ');
      const totalTokens = chunks.reduce((sum: number, c: any) => sum + (c.token_count || 0), 0);

      return successResponse({
        documentId,
        text: fullText,
        chunkCount: chunks.length,
        tokenCount: totalTokens,
      }, undefined, 3600);
    }

    // GET /documents/{id} — single document detail
    if (documentId) {
      const { data, error } = await db
        .from('community_crawled_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !data) {
        return errorResponse('NOT_FOUND', `Document '${documentId}' not found.`, 404);
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const downloadUrl = data.storage_key 
        ? `${supabaseUrl}/storage/v1/object/public/product-documents/${data.storage_key}`
        : null;

      return successResponse({
        id: data.id,
        sourceId: data.source_id,
        sourceUrl: data.source_url,
        filename: data.filename,
        title: data.title,
        documentType: data.document_type,
        language: data.language,
        sizeBytes: data.size_bytes,
        pageCount: data.page_count,
        chunkCount: data.chunk_count,
        extractionConfidence: data.extraction_confidence,
        downloadUrl,
        textEndpoint: `/v1/documents/${data.id}/text`,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }, undefined, 3600);
    }

    // GET /documents — list documents
    const { limit, offset, search } = parseQueryParams(url);
    const sourceId = url.searchParams.get('sourceId') || '';
    const documentType = url.searchParams.get('documentType') || '';

    let query = db.from('community_crawled_documents').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`title.ilike.%${search}%,filename.ilike.%${search}%`);
    }
    if (sourceId) query = query.eq('source_id', sourceId);
    if (documentType) query = query.eq('document_type', documentType);

    const { data, count, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const formatted = (data || []).map((row: any) => ({
      id: row.id,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      filename: row.filename,
      title: row.title,
      documentType: row.document_type,
      language: row.language,
      sizeBytes: row.size_bytes,
      pageCount: row.page_count,
      chunkCount: row.chunk_count,
      extractionConfidence: row.extraction_confidence,
      downloadUrl: row.storage_key
        ? `${supabaseUrl}/storage/v1/object/public/product-documents/${row.storage_key}`
        : null,
      createdAt: row.created_at,
    }));

    return listResponse(formatted, { total: count || 0, limit, offset }, 3600);
  } catch (e) {
    console.error(e);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
});
