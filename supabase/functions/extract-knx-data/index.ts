// v1 - KNX data extraction via Claude with PDF
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CRAWLER_SERVICE_KEY = Deno.env.get("CRAWLER_SERVICE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

serve(async (req) => {
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

  try {
    // 1. Download the PDF
    const pdfResponse = await fetch(pdf_url, {
      headers: { "User-Agent": "KNXforgeBot/1.0" },
    });

    if (!pdfResponse.ok) {
      return new Response(JSON.stringify({ error: `PDF download failed: HTTP ${pdfResponse.status}` }), { status: 400 });
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    
    if (pdfBytes.length > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "PDF too large (>20MB)" }), { status: 400 });
    }

    // 2. Convert to base64
    let binary = "";
    const chunkSize = 32768;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, i + chunkSize);
      const arr = Array.from(chunk);
      binary += String.fromCharCode(...arr);
    }
    const pdfBase64 = btoa(binary);

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

    // 6. Return extracted data
    return new Response(JSON.stringify({
      action: "extracted",
      product: product_name,
      orderNumber: order_number,
      communicationObjects: parsed.communicationObjects || [],
      parameters: parsed.parameters || [],
      functionalBlocks: parsed.functionalBlocks || [],
      technicalSpecifications: parsed.technicalSpecifications || [],
      extractionConfidence: parsed.extractionConfidence || 0,
      usage: claudeData.usage || {},
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Processing failed: ${err.message}` }), { status: 500 });
  }
});