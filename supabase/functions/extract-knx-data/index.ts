// v3 - Phase 1: Download PDF, extract English pages, fire-and-forget to extract-knx-objects
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

const CRAWLER_SERVICE_KEY = Deno.env.get("CRAWLER_SERVICE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  console.log('extract-knx-data called', {
    hasAnthropicKey: !!ANTHROPIC_API_KEY,
    hasCrawlerKey: !!CRAWLER_SERVICE_KEY,
  });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== CRAWLER_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const { pdf_url, product_name, order_number, manufacturer, category } = body;

    if (!pdf_url) {
      return new Response(JSON.stringify({ error: "pdf_url is required" }), { status: 400 });
    }

    // 1. Download the PDF
    console.log('Downloading PDF...', new Date().toISOString());
    const pdfResponse = await fetch(pdf_url, {
      headers: { "User-Agent": "KNXforgeBot/1.0" },
    });

    if (!pdfResponse.ok) {
      return new Response(JSON.stringify({ error: `PDF download failed: HTTP ${pdfResponse.status}` }), { status: 400 });
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());

    // 2. Intelligent page extraction for large PDFs
    let processedPdfBytes = pdfBytes;
    let totalPages = 0;
    let extractedPageCount = 0;

    try {
      console.log('pdf-lib loaded, attempting to parse PDF...');
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      totalPages = pdfDoc.getPageCount();
      extractedPageCount = totalPages;
      console.log(`PDF has ${totalPages} pages, size: ${pdfBytes.length} bytes`);

      if (totalPages > 100) {
        // Sample pages: first 5 + middle 3 for language detection
        const tocPdf = await PDFDocument.create();
        const samplePages: number[] = [];
        for (let i = 0; i < Math.min(5, totalPages); i++) samplePages.push(i);
        const mid = Math.floor(totalPages / 2);
        for (let i = mid; i < Math.min(mid + 3, totalPages); i++) {
          if (!samplePages.includes(i)) samplePages.push(i);
        }

        const copiedPages = await tocPdf.copyPages(pdfDoc, samplePages);
        for (const page of copiedPages) tocPdf.addPage(page);
        const tocBase64 = toBase64(new Uint8Array(await tocPdf.save()));

        // Ask Claude to identify the English page range
        const pageDetectResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': ANTHROPIC_API_KEY,
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: tocBase64 },
                },
                {
                  type: 'text',
                  text: `This PDF has ${totalPages} pages total. It is a KNX product technical documentation that contains the same content repeated in multiple languages.

Look at the sample pages. Identify:
1. How many languages are in this document
2. The page range for the ENGLISH section only

Typical structure: German first (pages 1-N), then English (pages N+1 to 2N), then French, etc. Each language section is roughly ${Math.floor(totalPages / 3)} to ${Math.floor(totalPages / 2)} pages.

If you see a table of contents, use it to determine exact page ranges.
If you cannot determine exactly, estimate: startPage = ${Math.floor(totalPages / 3) + 1}, endPage = ${Math.floor(totalPages * 2 / 3)}.

IMPORTANT: The English section should be no more than 60 pages. If your estimate is larger, narrow it to the most important pages (communication objects tables, parameters, technical data).

Respond with ONLY valid JSON:
{"startPage": 1, "endPage": 50, "language": "en", "estimatedLanguages": 3, "confidence": 0.8}`
                }
              ]
            }]
          }),
        });

        if (pageDetectResponse.ok) {
          const detectData = await pageDetectResponse.json();
          const detectText = (detectData.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
          const cleaned = detectText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

          try {
            const pageRange = JSON.parse(cleaned);
            const start = Math.max(0, (pageRange.startPage || 1) - 1);
            const end = Math.min(totalPages, pageRange.endPage || 100);

            console.log(`Detected English section: pages ${start + 1}-${end} (confidence: ${pageRange.confidence})`);

            // Hard cap at 60 pages to stay under token limit
            const maxPages = 60;
            let adjustedEnd = end;
            if ((end - start) > maxPages) {
              adjustedEnd = start + maxPages;
              console.log(`Capped English section from ${end - start} to ${maxPages} pages`);
            }
            const pageIndices = Array.from({ length: adjustedEnd - start }, (_, i) => start + i);

            const engPdf = await PDFDocument.create();
            const engPages = await engPdf.copyPages(pdfDoc, pageIndices);
            for (const page of engPages) engPdf.addPage(page);
            processedPdfBytes = new Uint8Array(await engPdf.save());
            extractedPageCount = pageIndices.length;

            console.log(`Extracted ${extractedPageCount} English pages, new size: ${processedPdfBytes.length} bytes`);
          } catch (parseErr) {
            console.error('Failed to parse page range:', parseErr.message);
            const fallbackPdf = await PDFDocument.create();
            const fallbackCount = Math.min(95, totalPages);
            const fallbackPages = await fallbackPdf.copyPages(pdfDoc, Array.from({ length: fallbackCount }, (_, i) => i));
            for (const page of fallbackPages) fallbackPdf.addPage(page);
            processedPdfBytes = new Uint8Array(await fallbackPdf.save());
            extractedPageCount = fallbackCount;
            console.log('Fallback: using first 95 pages');
          }
        }
      }
    } catch (pdfErr) {
      console.error('PDF page extraction error:', pdfErr.message);
    }

    // 3. Update extraction_status to 'extracting'
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (order_number) {
      await db.from('community_products')
        .update({ extraction_status: 'extracting', extraction_started_at: new Date().toISOString() })
        .ilike('order_number', `%${order_number}%`);
    }

    // 4. Convert trimmed PDF to base64
    const pdfBase64 = toBase64(processedPdfBytes);
    console.log(`PDF base64 ready, length: ${pdfBase64.length} chars`, new Date().toISOString());

    // 4. Fire-and-forget call to extract-knx-objects for Claude extraction + DB storage
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-knx-objects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRAWLER_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdf_base64: pdfBase64,
        product_name,
        order_number,
        manufacturer,
        category,
      }),
    }).catch(e => console.error('extract-knx-objects call failed:', e.message));

    // 5. Return immediately
    return new Response(JSON.stringify({
      action: 'processing',
      message: 'PDF downloaded and trimmed. KNX data extraction started in background.',
      product: product_name,
      orderNumber: order_number,
      totalPages,
      englishPages: extractedPageCount,
      pdfSizeBytes: processedPdfBytes.length,
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error('Fatal error:', err.message, err.stack);
    return new Response(JSON.stringify({ error: `Fatal error: ${err.message}` }), { status: 500 });
  }
});
