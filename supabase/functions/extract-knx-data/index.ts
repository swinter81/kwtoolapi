// v2 - KNX data extraction via Claude with PDF + intelligent page extraction
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
    hasServiceRole: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
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

    try {
      console.log('pdf-lib loaded, attempting to parse PDF...');
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      totalPages = pdfDoc.getPageCount();
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

            console.log(`Extracted ${pageIndices.length} English pages, new size: ${processedPdfBytes.length} bytes`);
          } catch (parseErr) {
            console.error('Failed to parse page range:', parseErr.message);
            const fallbackPdf = await PDFDocument.create();
            const fallbackPages = await fallbackPdf.copyPages(pdfDoc, Array.from({ length: Math.min(95, totalPages) }, (_, i) => i));
            for (const page of fallbackPages) fallbackPdf.addPage(page);
            processedPdfBytes = new Uint8Array(await fallbackPdf.save());
            console.log('Fallback: using first 95 pages');
          }
        }
      }
    } catch (pdfErr) {
      console.error('PDF page extraction error:', pdfErr.message);
    }

    // 3. Convert to base64
    const pdfBase64 = toBase64(processedPdfBytes);

    // 3. Build Claude prompt
    const prompt = `You are a KNX building automation expert. Extract ALL KNX-compliant product data from this PDF datasheet.

Product: ${product_name || "Unknown"}
Order Number: ${order_number || "Unknown"}
Manufacturer: ${manufacturer || "Unknown"}
Category: ${category || "Unknown"}

Analyze the PDF and extract EVERY detail. Respond with ONLY valid JSON (no markdown, no code fences):
{
  "communicationObjects": [
    {
      "objectNumber": 0,
      "name": "Switching",
      "functionText": "Switch output on/off",
      "channelNumber": 1,
      "channelName": "Output A",
      "functionalBlock": "Switching",
      "dptId": "1.001",
      "dptName": "DPT_Switch",
      "dptSizeBits": 1,
      "dptUnit": null,
      "readFlag": true,
      "writeFlag": true,
      "communicateFlag": true,
      "transmitFlag": false,
      "updateFlag": true,
      "readOnInitFlag": false,
      "priority": "low",
      "description": "Switches output on or off"
    }
  ],
  "parameters": [
    {
      "paramName": "Switch-on delay",
      "paramGroup": "Channel A",
      "paramSubgroup": "Switching behavior",
      "channelNumber": 1,
      "channelName": "Output A",
      "paramType": "enum",
      "defaultValue": "0",
      "valueMin": null,
      "valueMax": null,
      "valueUnit": "s",
      "stepSize": null,
      "enumValues": [{"value": "0", "label": "Disabled"}, {"value": "1", "label": "1s"}],
      "description": "Delay before switching on"
    }
  ],
  "functionalBlocks": [
    {
      "blockName": "Switch Output",
      "blockType": "switching",
      "channelCount": 8,
      "description": "8 independent switching outputs"
    }
  ],
  "technicalSpecifications": [
    {
      "specCategory": "electrical",
      "specName": "Operating voltage",
      "specValue": "AC 230 V",
      "specUnit": "V",
      "specValueNumeric": 230
    }
  ],
  "extractionConfidence": 0.9
}

Rules:
- Extract ALL communication objects listed in the PDF for ALL channels
- Extract ALL parameters from the PDF
- Use correct KNX DPTs (1.001=Switch, 1.008=Up/Down, 3.007=DimmingControl, 5.001=Percentage, 9.001=Temperature, etc.)
- Spec categories: electrical, mechanical, environmental, knx_bus, certification
- For multi-channel devices, include objects/params for EACH channel
- Set flags correctly based on the PDF tables
- Only extract what is actually in the PDF, do NOT invent data`;

    // 4. Call Claude API with PDF
    console.log('Starting Claude extraction...', new Date().toISOString());
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 16384,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      return new Response(JSON.stringify({ error: `Claude API error: ${claudeResponse.status} ${errText}` }), { status: 500 });
    }

    const claudeData = await claudeResponse.json();

    // 5. Parse Claude's response
    let text = "";
    if (claudeData.content && Array.isArray(claudeData.content)) {
      text = claudeData.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    }

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: "Failed to parse Claude response",
        rawPreview: cleaned.slice(0, 1000),
      }), { status: 500 });
    }

    // 6. Store extracted data in the database
    console.log('Claude extraction complete, storing data...', new Date().toISOString());
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: products } = await db.from('community_products')
      .select('id')
      .ilike('order_number', `%${order_number}%`)
      .limit(1);

    const productId = products?.[0]?.id;
    let storedCommunicationObjects = 0;
    let storedParameters = 0;
    let storedFunctionalBlocks = 0;
    let storedTechnicalSpecifications = 0;

    if (productId) {
      // Batch store communication objects
      if (parsed.communicationObjects?.length) {
        const rows = parsed.communicationObjects.map((obj: any) => ({
          product_id: productId,
          object_number: obj.objectNumber,
          name: obj.name,
          function_text: obj.functionText || null,
          channel_number: obj.channelNumber || null,
          channel_name: obj.channelName || null,
          functional_block: obj.functionalBlock || null,
          dpt_id: obj.dptId || null,
          dpt_name: obj.dptName || null,
          dpt_size_bits: obj.dptSizeBits || null,
          dpt_unit: obj.dptUnit || null,
          read_flag: obj.readFlag || false,
          write_flag: obj.writeFlag || false,
          communicate_flag: obj.communicateFlag || false,
          transmit_flag: obj.transmitFlag || false,
          update_flag: obj.updateFlag || false,
          read_on_init_flag: obj.readOnInitFlag || false,
          priority: obj.priority || 'low',
          description: obj.description || null,
          extraction_confidence: parsed.extractionConfidence || 0.7,
        }));
        const { error } = await db.from('community_communication_objects').insert(rows);
        if (error) console.error('Failed to store comm objects:', error.message);
        else { storedCommunicationObjects = rows.length; console.log(`Stored ${rows.length} communication objects`); }
      }

      // Batch store parameters
      if (parsed.parameters?.length) {
        const rows = parsed.parameters.map((param: any) => ({
          product_id: productId,
          param_name: param.paramName,
          param_group: param.paramGroup || null,
          param_subgroup: param.paramSubgroup || null,
          channel_number: param.channelNumber || null,
          channel_name: param.channelName || null,
          param_type: param.paramType || 'text',
          default_value: param.defaultValue != null ? String(param.defaultValue) : null,
          value_min: param.valueMin != null ? String(param.valueMin) : null,
          value_max: param.valueMax != null ? String(param.valueMax) : null,
          value_unit: param.valueUnit || null,
          step_size: param.stepSize != null ? String(param.stepSize) : null,
          enum_values: param.enumValues ? JSON.stringify(param.enumValues) : null,
          description: param.description || null,
          extraction_confidence: parsed.extractionConfidence || 0.7,
        }));
        const { error } = await db.from('community_parameters').insert(rows);
        if (error) console.error('Failed to store parameters:', error.message);
        else { storedParameters = rows.length; console.log(`Stored ${rows.length} parameters`); }
      }

      // Batch store functional blocks
      if (parsed.functionalBlocks?.length) {
        const rows = parsed.functionalBlocks.map((block: any) => ({
          product_id: productId,
          block_name: block.blockName,
          block_type: block.blockType || null,
          channel_count: block.channelCount || null,
          description: block.description || null,
          extraction_confidence: parsed.extractionConfidence || 0.7,
        }));
        const { error } = await db.from('community_functional_blocks').insert(rows);
        if (error) console.error('Failed to store functional blocks:', error.message);
        else { storedFunctionalBlocks = rows.length; console.log(`Stored ${rows.length} functional blocks`); }
      }

      // Batch store technical specifications
      if (parsed.technicalSpecifications?.length) {
        const rows = parsed.technicalSpecifications.map((spec: any) => ({
          product_id: productId,
          spec_category: spec.specCategory,
          spec_name: spec.specName,
          spec_value: spec.specValue,
          spec_unit: spec.specUnit || null,
          spec_value_numeric: spec.specValueNumeric || null,
          extraction_confidence: parsed.extractionConfidence || 0.7,
        }));
        const { error } = await db.from('community_technical_specifications').insert(rows);
        if (error) console.error('Failed to store tech specs:', error.message);
        else { storedTechnicalSpecifications = rows.length; console.log(`Stored ${rows.length} technical specifications`); }
      }

      console.log('Database storage complete', new Date().toISOString());
    }

    // 7. Return extracted data with storage counts
    return new Response(JSON.stringify({
      action: "extracted",
      product: product_name,
      orderNumber: order_number,
      productId: productId || null,
      communicationObjects: parsed.communicationObjects || [],
      parameters: parsed.parameters || [],
      functionalBlocks: parsed.functionalBlocks || [],
      technicalSpecifications: parsed.technicalSpecifications || [],
      extractionConfidence: parsed.extractionConfidence || 0,
      storedCommunicationObjects,
      storedParameters,
      storedFunctionalBlocks,
      storedTechnicalSpecifications,
      usage: claudeData.usage || {},
    }), {
      headers: { "Content-Type": "application/json" },
    });




  } catch (err) {
    console.error('Fatal error:', err.message, err.stack);
    return new Response(JSON.stringify({ error: `Fatal error: ${err.message}` }), { status: 500 });
  }
});