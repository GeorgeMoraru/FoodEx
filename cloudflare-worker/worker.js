export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GEMINI_API_KEY secret is not set in Cloudflare Worker" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await request.json();
      const imageBase64 = body.imageBase64 || body.data?.imageBase64;
      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "Missing imageBase64 in request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const models = ["gemini-flash-latest", "gemini-3.7-flash", "gemini-pro-latest"];
      let extractedDate = null;
      let lastError = null;

      for (const model of models) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: "You are an expert OCR vision system for food expiration tracking. Locate any expiration date, best before date, use by date, EXP, BB, or date stamp in this image (e.g. 2026-11-28, 15/09/2026, 12/26, 24 NOV 2026). Return ONLY the date string. If no date is present at all, return 'NONE'.",
                      },
                      {
                        inlineData: {
                          mimeType: "image/jpeg",
                          data: imageBase64,
                        },
                      },
                    ],
                  },
                ],
              }),
            }
          );

          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text && text.toUpperCase() !== "NONE" && text.toLowerCase() !== "null") {
              extractedDate = text;
              break;
            }
          } else {
            lastError = await geminiRes.text();
          }
        } catch (err) {
          lastError = err.message;
        }
      }

      return new Response(JSON.stringify({ date: extractedDate, error: lastError }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
