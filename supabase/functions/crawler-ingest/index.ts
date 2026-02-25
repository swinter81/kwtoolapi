import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRAWLER_SERVICE_KEY = Deno.env.get("CRAWLER_SERVICE_KEY")!;

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader !== `Bearer ${CRAWLER_SERVICE_KEY}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/crawler-ingest\/?/, "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── UPSERT PRODUCT ──────────────────────────────────
    if (req.method === "POST" && (path === "products" || path === "/products")) {
      const body = await req.json();
      const { manufacturerKnxId, name, orderNumber, description, mediumTypes, category, specifications, source, confidence } = body;

      if (!name && !orderNumber) {
        return json({ error: "name or orderNumber required" }, 400);
      }

      // Find manufacturer
      const { data: mfr, error: mfrErr } = await supabase
        .from("manufacturers")
        .select("id")
        .eq("knx_manufacturer_id", manufacturerKnxId)
        .schema("community")
        .single();

      if (mfrErr || !mfr) {
        return json({ error: `Manufacturer ${manufacturerKnxId} not found in community.manufacturers` }, 404);
      }

      // Try match by order number
      if (orderNumber) {
        const normalized = orderNumber.replace(/[\s\-\.]/g, "").toUpperCase();
        const { data: existing } = await supabase
          .from("products")
          .select("*")
          .eq("manufacturer_id", mfr.id)
          .schema("community");

        const match = (existing || []).find((p: any) =>
          p.order_number && p.order_number.replace(/[\s\-\.]/g, "").toUpperCase() === normalized
        );

        if (match) {
          // Enrich existing
          const updates: Record<string, any> = { updated_at: new Date().toISOString() };
          if (name && !match.name) updates.name = name;
          if (description && !match.description) updates.description = description;
          if (category && !match.category) updates.category = category;
          if (mediumTypes?.length && !match.medium_types?.length) updates.medium_types = mediumTypes;
          if (specifications && !match.specifications) updates.specifications = specifications;
          updates.source_count = (match.source_count || 1) + 1;
          updates.confidence_score = Math.min(1.0, (match.confidence_score || 0) + 0.1);
          if (source) updates.crawler_source_url = source;

          await supabase.from("products").update(updates).eq("id", match.id).schema("community");
          return json({ id: match.id, action: "enriched" });
        }
      }

      // Create new
      const productId = `prod_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const { error: insertErr } = await supabase
        .from("products")
        .insert({
          id: productId,
          manufacturer_id: mfr.id,
          name: name || null,
          order_number: orderNumber || null,
          description: description || null,
          medium_types: mediumTypes || [],
          category: category || null,
          specifications: specifications || null,
          confidence_score: confidence || 0.5,
          crawler_source_url: source || null,
          status: (confidence || 0) >= 0.7 ? "approved" : "pending_review",
        })
        .schema("community");

      if (insertErr) return json({ error: insertErr.message }, 500);
      return json({ id: productId, action: "created" });
    }

    // ── CREATE DOCUMENT ─────────────────────────────────
    if (req.method === "POST" && (path === "documents" || path === "/documents")) {
      const body = await req.json();
      const { sourceId, sourceUrl, filename, sha256, documentType, title, language, version, applicableProductIds, pageCount, sizeBytes } = body;

      // Dedup check
      const { data: existing } = await supabase
        .from("crawled_documents")
        .select("id")
        .eq("sha256", sha256)
        .schema("community")
        .single();

      if (existing) {
        return json({ documentId: existing.id, action: "duplicate" });
      }

      const { data, error } = await supabase
        .from("crawled_documents")
        .insert({
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
          applicable_product_ids: applicableProductIds || [],
        })
        .schema("community")
        .select("id")
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ documentId: data.id, action: "created" });
    }

    // ── UPLOAD CHUNKS ───────────────────────────────────
    if (req.method === "POST" && path.match(/^documents\/[^/]+\/chunks/)) {
      const docId = path.split("/")[1];
      const body = await req.json();
      const chunks = body.chunks || [];

      const rows = chunks.map((c: any) => ({
        document_id: docId,
        chunk_index: c.index,
        page_number: c.pageNumber || null,
        content: c.text,
        headings: c.headings || [],
        token_count: c.tokenCount || Math.ceil((c.text || "").length / 4),
      }));

      const { error } = await supabase
        .from("crawled_document_chunks")
        .insert(rows)
        .schema("community");

      if (error) return json({ error: error.message }, 500);

      await supabase
        .from("crawled_documents")
        .update({ chunk_count: chunks.length })
        .eq("id", docId)
        .schema("community");

      return json({ chunksCreated: chunks.length });
    }

    // ── LOG CRAWL RUN ───────────────────────────────────
    if (req.method === "POST" && (path === "runs" || path === "/runs")) {
      const body = await req.json();
      const { error } = await supabase
        .from("crawl_runs")
        .insert(body)
        .schema("community");

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Not found", path }, 404);

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}
