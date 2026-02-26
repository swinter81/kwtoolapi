// Phase 2: Receive pre-processed PDF base64, call Claude for KNX extraction, batch-store results
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const CRAWLER_SERVICE_KEY = Deno.env.get("CRAWLER_SERVICE_KEY")!;

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== CRAWLER_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { pdf_base64, product_name, order_number, manufacturer, category } = await req.json();
    console.log('extract-knx-objects called for:', product_name, order_number, new Date().toISOString());

    if (!pdf_base64) {
      return new Response(JSON.stringify({ error: "pdf_base64 is required" }), { status: 400 });
    }

    // 1. Build Claude prompt
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

    // 2. Call Claude API with pre-processed PDF
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
                data: pdf_base64,
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
      console.error('Claude API error:', claudeResponse.status, errText);
      return new Response(JSON.stringify({ error: `Claude API error: ${claudeResponse.status}` }), { status: 500 });
    }

    const claudeData = await claudeResponse.json();
    console.log('Claude extraction complete', new Date().toISOString(), 'usage:', JSON.stringify(claudeData.usage || {}));

    // 3. Parse Claude's response
    let text = "";
    if (claudeData.content && Array.isArray(claudeData.content)) {
      text = claudeData.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    }

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Claude response:', cleaned.slice(0, 500));
      return new Response(JSON.stringify({
        error: "Failed to parse Claude response",
        rawPreview: cleaned.slice(0, 1000),
      }), { status: 500 });
    }

    // 4. Store extracted data in the database
    console.log('Storing data in DB...', new Date().toISOString());
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
    } else {
      console.warn('No product found for order_number:', order_number);
    }

    // 5. Return results
    return new Response(JSON.stringify({
      action: "extracted",
      product: product_name,
      orderNumber: order_number,
      productId: productId || null,
      storedCommunicationObjects,
      storedParameters,
      storedFunctionalBlocks,
      storedTechnicalSpecifications,
      extractionConfidence: parsed.extractionConfidence || 0,
      usage: claudeData.usage || {},
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error('Fatal error:', err.message, err.stack);
    return new Response(JSON.stringify({ error: `Fatal error: ${err.message}` }), { status: 500 });
  }
});
