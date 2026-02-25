const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRAWLER_SERVICE_KEY = Deno.env.get("CRAWLER_SERVICE_KEY")!;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function authHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function pgGet(table: string, query: string) {
  const res = await fetch(`${REST_URL}/${table}?${query}`, {
    headers: { ...authHeaders(), "Accept-Profile": "community" },
  });
  return res.json();
}

async function pgInsert(table: string, body: unknown, returnData = false) {
  const headers: Record<string, string> = {
    ...authHeaders(),
    "Content-Profile": "community",
    "Content-Type": "application/json",
  };
  if (returnData) headers["Prefer"] = "return=representation";

  const res = await fetch(`${REST_URL}/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (returnData) return { data: await res.json(), status: res.status };
  return { status: res.status, data: null };
}

async function pgUpdate(table: string, query: string, body: unknown) {
  const res = await fetch(`${REST_URL}/${table}?${query}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(),
      "Content-Profile": "community",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const ah = req.headers.get("Authorization") || "";
  if (ah !== `Bearer ${CRAWLER_SERVICE_KEY}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    const { action, ...payload } = body;

    switch (action) {
      case "upsert_product":
        return await upsertProduct(payload);
      case "create_document":
        return await createDocument(payload);
      case "upload_chunks":
        return await uploadChunks(payload);
      case "log_run":
        return await logRun(payload);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

// ── UPSERT PRODUCT ──────────────────────────────────────
async function upsertProduct(p: any) {
  const { manufacturerKnxId, name, orderNumber, description, mediumTypes, category, specifications, source, confidence } = p;

  if (!name && !orderNumber) {
    return json({ error: "name or orderNumber required" }, 400);
  }

  const mfrs = await pgGet("manufacturers", `knx_manufacturer_id=eq.${encodeURIComponent(manufacturerKnxId)}&select=id`);
  if (!Array.isArray(mfrs) || mfrs.length === 0) {
    return json({ error: `Manufacturer ${manufacturerKnxId} not found` }, 404);
  }
  const mfrId = mfrs[0].id;

  if (orderNumber) {
    const normalized = orderNumber.replace(/[\s\-\.]/g, "").toUpperCase();
    const products = await pgGet("products", `manufacturer_id=eq.${encodeURIComponent(mfrId)}&select=*`);

    const match = (products || []).find((pr: any) =>
      pr.order_number && pr.order_number.replace(/[\s\-\.]/g, "").toUpperCase() === normalized
    );

    if (match) {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (name && !match.name) updates.name = name;
      if (description && !match.description) updates.description = description;
      if (category && !match.category) updates.category = category;
      if (mediumTypes?.length && !match.medium_types?.length) updates.medium_types = mediumTypes;
      if (specifications && !match.specifications) updates.specifications = specifications;
      updates.source_count = (match.source_count || 1) + 1;
      updates.confidence_score = Math.min(1.0, (match.confidence_score || 0) + 0.1);
      if (source) updates.crawler_source_url = source;

      await pgUpdate("products", `id=eq.${encodeURIComponent(match.id)}`, updates);
      return json({ id: match.id, action: "enriched" });
    }
  }

  const productId = `prod_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const { status } = await pgInsert("products", {
    id: productId,
    manufacturer_id: mfrId,
    name: name || null,
    order_number: orderNumber || null,
    description: description || null,
    medium_types: mediumTypes || [],
    category: category || null,
    specifications: specifications || null,
    confidence_score: confidence || 0.5,
    crawler_source_url: source || null,
    status: (confidence || 0) >= 0.7 ? "approved" : "pending_review",
  });

  if (status >= 400) return json({ error: "Insert failed" }, 500);
  return json({ id: productId, action: "created" });
}

// ── CREATE DOCUMENT ─────────────────────────────────────
async function createDocument(p: any) {
  const { sourceId, sourceUrl, filename, sha256, documentType, title, language, version, pageCount, sizeBytes } = p;

  const existing = await pgGet("crawled_documents", `sha256=eq.${encodeURIComponent(sha256)}&select=id`);
  if (Array.isArray(existing) && existing.length > 0) {
    return json({ documentId: existing[0].id, action: "duplicate" });
  }

  const { data, status } = await pgInsert("crawled_documents", {
    source_id: sourceId || null,
    source_url: sourceUrl,
    filename,
    sha256,
    size_bytes: sizeBytes || null,
    page_count: pageCount || null,
    document_type: documentType || null,
    title: title || null,
    language: language || null,
    doc_version: version || null,
  }, true);

  if (status >= 400) return json({ error: "Insert failed", detail: data }, 500);
  const doc = Array.isArray(data) ? data[0] : data;
  return json({ documentId: doc.id, action: "created" });
}

// ── UPLOAD CHUNKS ───────────────────────────────────────
async function uploadChunks(p: any) {
  const { documentId, chunks } = p;
  if (!documentId || !chunks?.length) {
    return json({ error: "documentId and chunks required" }, 400);
  }

  const rows = chunks.map((c: any) => ({
    document_id: documentId,
    chunk_index: c.index,
    page_number: c.pageNumber || null,
    content: c.text,
    headings: c.headings || [],
    token_count: c.tokenCount || Math.ceil((c.text || "").length / 4),
  }));

  const { status } = await pgInsert("crawled_document_chunks", rows);
  if (status >= 400) return json({ error: "Chunk insert failed" }, 500);

  await pgUpdate("crawled_documents", `id=eq.${encodeURIComponent(documentId)}`, { chunk_count: chunks.length });

  return json({ chunksCreated: chunks.length });
}

// ── LOG CRAWL RUN ───────────────────────────────────────
async function logRun(p: any) {
  const { status } = await pgInsert("crawl_runs", p);
  if (status >= 400) return json({ error: "Insert failed" }, 500);
  return json({ ok: true });
}
