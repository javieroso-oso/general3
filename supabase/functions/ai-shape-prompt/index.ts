// Edge function: AI describe-to-parameters
// Takes a natural-language prompt, returns a partial ParametricParams JSON

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a parametric 3D shape designer for general3, a tool for designing printable vase/lamp objects. The user describes the shape they want; you respond with a single tool call that sets parameters.

Guidelines:
- Choose tasteful, harmonious values; avoid extreme overlapping deformations.
- Heights are in mm. Aim for height between 60 and 250.
- Base/top radii in mm, typically 20-70.
- Use bulge for round bellies, pinch for narrow waists, lipFlare for opening rims.
- Use lobeCount > 1 for stacked organic shapes (snowman, cairn, fruit-stack).
- Use profileCurve "hourglass" for narrow-waist forms, "convex" for bellies.
- Set unused parameters to 0 (don't combine too many effects).
- Twist 0-90 for subtle spiral, organicNoise 0-0.04 for natural roughness.`;

interface ToolParams {
  height: number;
  baseRadius: number;
  topRadius: number;
  bulgePosition: number;
  bulgeAmount: number;
  pinchAmount: number;
  asymmetry: number;
  twistAngle: number;
  profileCurve: 'linear' | 'convex' | 'concave' | 'hourglass' | 'wave';
  lipFlare: number;
  lipHeight: number;
  organicNoise: number;
  lobeCount: number;
  lobeBlend: number;
  roundnessTop: number;
  roundnessBottom: number;
  meltAmount: number;
  facetCount: number;
  flutingCount: number;
  flutingDepth: number;
  rationale: string;
}

const tool = {
  type: "function" as const,
  function: {
    name: "set_shape_parameters",
    description: "Set parameter values to produce the user's described shape.",
    parameters: {
      type: "object",
      properties: {
        height: { type: "number", description: "Height in mm (60-250)" },
        baseRadius: { type: "number", description: "Base radius in mm (15-70)" },
        topRadius: { type: "number", description: "Top radius in mm (10-70)" },
        bulgePosition: { type: "number", description: "0-1 height fraction of belly" },
        bulgeAmount: { type: "number", description: "0-0.3" },
        pinchAmount: { type: "number", description: "0-0.2" },
        asymmetry: { type: "number", description: "0-0.15" },
        twistAngle: { type: "number", description: "Degrees, 0-90" },
        profileCurve: { type: "string", enum: ["linear", "convex", "concave", "hourglass", "wave"] },
        lipFlare: { type: "number", description: "0-0.3 outward rim flare" },
        lipHeight: { type: "number", description: "0-0.15 fraction of total height for lip" },
        organicNoise: { type: "number", description: "0-0.05 surface noise" },
        lobeCount: { type: "number", description: "1=single body, 2-4=stacked lobes" },
        lobeBlend: { type: "number", description: "0-1 smoothness between lobes" },
        roundnessTop: { type: "number", description: "0-1 top dome roundness" },
        roundnessBottom: { type: "number", description: "0-1 bottom dome roundness" },
        meltAmount: { type: "number", description: "0-30mm vertical droop" },
        facetCount: { type: "number", description: "Integer 0-12 vertical facets" },
        flutingCount: { type: "number", description: "Integer 0-24 vertical grooves" },
        flutingDepth: { type: "number", description: "0-0.05 fluting depth" },
        rationale: { type: "string", description: "One sentence describing the design choice" },
      },
      required: ["height", "baseRadius", "topRadius", "profileCurve", "rationale"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "set_shape_parameters" } },
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResponse.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      console.error("AI gateway error", aiResponse.status, text);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI returned no parameters" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = JSON.parse(toolCall.function.arguments) as ToolParams;
    return new Response(JSON.stringify({ params }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-shape-prompt error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
