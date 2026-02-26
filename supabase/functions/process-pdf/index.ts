// v2 - redeployed 2026-02-26
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRAWLER_SERVICE_KEY = Deno.env.get("CRAWLER_SERVICE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Auth check
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== CRAWLER_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (action === "process_pdf") {
    const { url, source_id, crawl_url_id } = body;

    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), { status: 400 });
    }

    try {
      // 1. Download the PDF
      const pdfResponse = await fetch(url, {
        headers: {
          "User-Agent": "KNXforgeBot/1.0 (+https://knxforge.dev/bot)",
          "Accept": "application/pdf,*/*",
        },
      });

      if (!pdfResponse.ok) {
        return new Response(JSON.stringify({ 
          error: `Failed to download PDF: HTTP ${pdfResponse.status}` 
        }), { status: 400 });
      }

      const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
      const sizeBytes = pdfBytes.length;

      if (sizeBytes < 100) {
        return new Response(JSON.stringify({ error: "PDF too small, likely not a real PDF" }), { status: 400 });
      }

      if (sizeBytes > 50 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "PDF too large (>50MB)" }), { status: 400 });
      }

      // 2. Compute SHA-256 hash
      const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha256 = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      // 3. Check if we already have this document
      const { data: existing } = await supabase
        .from("community_crawled_documents")
        .select("id")
        .eq("sha256", sha256)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({
          action: "duplicate",
          document_id: existing.id,
          sha256,
          message: "Document already exists",
        }));
      }

      // 4. Extract filename from URL
      const urlParts = url.split("/");
      let filename = urlParts[urlParts.length - 1].split("?")[0];
      if (!filename.toLowerCase().endsWith(".pdf")) {
        filename = filename + ".pdf";
      }
      // Clean filename
      filename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

      // 5. Upload to Supabase Storage
      const storagePath = `${source_id || "unknown"}/${sha256.slice(0, 8)}_${filename}`;
      
      const { error: uploadError } = await supabase.storage
        .from("product-documents")
        .upload(storagePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError && !uploadError.message.includes("already exists")) {
        return new Response(JSON.stringify({ 
          error: `Storage upload failed: ${uploadError.message}` 
        }), { status: 500 });
      }

      // 6. Skip text extraction — will be done later with a dedicated tool
      const pageCount = 0;

      // 9. Store document metadata
      const docId = crypto.randomUUID();
      const { error: docError } = await supabase
        .from("community_crawled_documents")
        .insert({
          id: docId,
          source_id: source_id || "unknown",
          source_url: url,
          filename,
          sha256,
          size_bytes: sizeBytes,
          page_count: pageCount,
          storage_key: storagePath,
          document_type: "datasheet",
        });

      if (docError) {
        return new Response(JSON.stringify({ 
          error: `Failed to store document: ${docError.message}` 
        }), { status: 500 });
      }

      // 10. Update crawl_url status if provided
      if (crawl_url_id) {
        await supabase
          .from("community_crawl_urls")
          .update({
            status: "completed",
            documents_extracted: 1,
            last_fetched_at: new Date().toISOString(),
          })
          .eq("id", crawl_url_id);
      }

      return new Response(JSON.stringify({
        action: "processed",
        document_id: docId,
        filename,
        sha256,
        size_bytes: sizeBytes,
        page_count: pageCount,
        text_length: 0,
        chunk_count: 0,
        storage_path: storagePath,
      }));

    } catch (err) {
      return new Response(JSON.stringify({ 
        error: `Processing failed: ${err.message}` 
      }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400 });
});
