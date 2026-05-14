// Edge function: AI describe-to-parameters
// Takes a natural-language prompt, returns a partial ParametricParams JSON

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert parametric 3D shape designer for general3, a tool that produces printable vase / lamp / vessel shapes built from a swept profile.

Your job: read the user's natural-language description and pick parameters that VISUALLY match it. Be bold and decisive — don't return a generic vase for every prompt. Use the full range of values.

Profile mental model:
- The shape is a body of revolution. profileCurve controls the silhouette from base→top.
  • "linear" = straight cone/cylinder
  • "convex" = belly bulges outward (use for "round", "fat", "pot-bellied")
  • "concave" = pinched in middle, wider at ends
  • "hourglass" = strong narrow waist (use for "hourglass", "wasp waist", "pinched neck")
  • "wave" = undulating silhouette (use for "rippled", "wavy")
- baseRadius vs topRadius set the overall taper. For "narrow neck" make topRadius ~30-50% of baseRadius. For "flared opening" make topRadius > baseRadius.
- bulgePosition (0=bottom, 1=top) + bulgeAmount (0-0.3) add a localized belly. Use bulgeAmount 0.15-0.25 for pronounced bellies.
- pinchAmount (0-0.2) narrows the body opposite to the bulge. Combine with bulgePosition for organic shapes.
- lipFlare (0-0.3) flares the top rim outward; lipHeight (0.03-0.12) sets how much of the top is the flared lip.
- lobeCount > 1 stacks bulbs vertically (2 = peanut, 3 = snowman/cairn). lobeBlend 0.4-0.7 keeps them smoothly joined.
- twistAngle 20-90 adds a spiral; use for "twisted", "spiral".
- facetCount 4-12 = polygonal/faceted; flutingCount 8-24 + flutingDepth 0.02-0.04 = vertical grooves (Greek column, ridged).
- organicNoise 0.005-0.03 = subtle natural roughness. Don't exceed 0.04.
- meltAmount 5-20 = drooping Dalí melt.
- height 60-250 mm. "tall" = 180-240, "short/squat" = 70-110, default ~150.
- baseRadius typically 25-65 mm.

Examples (study these — match this level of decisiveness):
- "tall narrow vase with flared lip" → height 220, baseRadius 35, topRadius 30, profileCurve "linear", lipFlare 0.18, lipHeight 0.08, bulgeAmount 0, lobeCount 1.
- "fat round belly, pinched neck, organic" → height 160, baseRadius 35, topRadius 25, profileCurve "convex", bulgePosition 0.45, bulgeAmount 0.22, pinchAmount 0.08, organicNoise 0.015, lobeCount 1.
- "three stacked spheres like a snowman" → height 200, baseRadius 50, topRadius 30, profileCurve "convex", lobeCount 3, lobeBlend 0.55, bulgeAmount 0.18, lipFlare 0.
- "twisted hourglass with subtle ridges" → height 200, baseRadius 45, topRadius 45, profileCurve "hourglass", twistAngle 60, flutingCount 12, flutingDepth 0.025.
- "squat faceted bowl" → height 80, baseRadius 60, topRadius 55, profileCurve "convex", facetCount 8, bulgeAmount 0.12, lipFlare 0.05.
- "tall fluted column" → height 240, baseRadius 40, topRadius 38, profileCurve "linear", flutingCount 18, flutingDepth 0.03.

Rules:
- Always set values that clearly express the description; don't return all-zeros for deformation params if the description implies them.
- Set unused features to 0 — DO NOT pile on every effect. Pick the 2-4 that match the description.
- If the user says "vase" without other detail, default to a tasteful tapered form, NOT a cylinder.
- Always include a one-sentence rationale describing your design choice.`;

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
        model: "google/gemini-2.5-pro",
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
