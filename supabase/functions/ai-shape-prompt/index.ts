// Edge function: AI describe-to-parameters
// Takes a natural-language prompt, returns a partial ParametricParams JSON

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an experimental parametric 3D shape art director for general3, a tool that produces printable vase / lamp / vessel shapes built from a swept profile.

Your job: read the user's natural-language description and create a visibly distinct printable object. Do NOT make a polite generic vase unless the user explicitly asks for a plain vase. Every response must choose a strong silhouette archetype, one primary surface language, and one memorable deformation. Use the full safe range of values.

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
- lobeCount > 1 stacks bulbs vertically (2 = peanut/gourd, 3 = snowman/cairn, 4 = totem). lobeBlend 0.35-0.75 controls separation; lobeSizeVariation and lobeHeightVariation make lobes less mechanical.
- spineEnabled with spineAmplitudeX/Z bends the whole object into an S-curve. Use for "leaning", "seaweed", "dancing", "branch", "flame".
- twistAngle 20-110 adds a spiral; use for "twisted", "spiral", "tornado", "shell".
- facetCount 4-12 = polygonal/faceted; flutingCount 8-28 + flutingDepth 0.02-0.08 = vertical grooves; spiralGrooveCount/Depth/Twist = shell/tornado/candy-stripe grooves; horizontalRibCount = stacked contour rings.
- rimWaveCount and rimWaveDepth create a wavy/floral/coral opening.
- organicNoise 0.005-0.03 = subtle natural roughness. Don't exceed 0.04.
- meltAmount 5-24 plus meltDragAmount creates drooping Dalí melt or wind-pulled clay.
- height 60-250 mm. "tall" = 180-240, "short/squat" = 70-110, default ~150.
- baseRadius typically 25-65 mm.

Creative archetypes to use when relevant:
- coral/anemone/flower: wave profile, topRadius larger than baseRadius, rimWaveCount 6-12, asymmetry, organicNoise.
- shell/tornado: tall taper, twistAngle 70-110, spiralGrooveCount 3-8, spiralGrooveTwist 3-7, small topRadius.
- brutal/faceted crystal: facetCount 5-9, facetSharpness 0.75-1, angular asymmetry, low lip.
- stacked/totem/gourd/snowman: lobeCount 2-4, roundnessTop/Bottom 0.35-0.8, varied lobes.
- melted/drippy candle: meltAmount 12-24, meltLobes 4-8, meltVariation 0.35-0.7, meltDelay 0.1-0.35.
- architectural/column: flutingCount 16-28, flutingDepth 0.035-0.075, mostly linear, strong height.
- creature/organic: spine bend, wobble, asymmetry, noise, uneven lip.

Examples (study these — match this level of decisiveness):
- "tall narrow vase with flared lip" → height 225, baseRadius 32, topRadius 22, profileCurve "concave", lipFlare 0.24, lipHeight 0.10, rimWaveCount 0, lobeCount 1.
- "fat round belly, pinched neck, organic" → height 155, baseRadius 42, topRadius 20, profileCurve "convex", bulgePosition 0.42, bulgeAmount 0.27, pinchAmount 0.16, asymmetry 0.08, organicNoise 0.018.
- "three stacked spheres like a snowman" → height 205, baseRadius 52, topRadius 32, profileCurve "convex", lobeCount 3, lobeBlend 0.42, lobeSizeVariation 0.45, roundnessTop 0.65, roundnessBottom 0.55, lipFlare 0.
- "twisted hourglass with subtle ridges" → height 210, baseRadius 46, topRadius 43, profileCurve "hourglass", twistAngle 85, flutingCount 14, flutingDepth 0.035, spiralGrooveCount 2, spiralGrooveDepth 0.025.
- "squat faceted bowl" → height 78, baseRadius 62, topRadius 70, profileCurve "convex", facetCount 7, facetSharpness 0.9, bulgeAmount 0.16, lipFlare 0.08.
- "alien coral flower" → height 145, baseRadius 28, topRadius 68, profileCurve "wave", rimWaveCount 9, rimWaveDepth 0.12, asymmetry 0.12, wobbleFrequency 3, wobbleAmplitude 0.07, organicNoise 0.025.
- "dripping candle tower" → height 230, baseRadius 36, topRadius 28, profileCurve "linear", meltAmount 20, meltLobes 6, meltVariation 0.55, meltDelay 0.18, horizontalRibCount 9, horizontalRibDepth 0.025.

Rules:
- Always set values that clearly express the description; don't return all-zeros for deformation params if the description implies them.
- Set unused features to 0 — DO NOT pile on every effect. Pick 3-5 matching controls, with one dominant effect that is obvious in the silhouette.
- For vague prompts, invent a bolder interpretation rather than defaulting to cylinder/vase.
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
  noiseScale: number;
  wobbleFrequency: number;
  wobbleAmplitude: number;
  spineEnabled: boolean;
  spineAmplitudeX: number;
  spineFrequencyX: number;
  spinePhaseX: number;
  spineAmplitudeZ: number;
  spineFrequencyZ: number;
  spinePhaseZ: number;
  lobeCount: number;
  lobeBlend: number;
  lobeSizeVariation: number;
  lobeHeightVariation: number;
  roundnessTop: number;
  roundnessBottom: number;
  meltAmount: number;
  meltLobes: number;
  meltVariation: number;
  meltPhase: number;
  meltDelay: number;
  meltDragAmount: number;
  meltDragAngle: number;
  facetCount: number;
  facetSharpness: number;
  spiralGrooveCount: number;
  spiralGrooveDepth: number;
  spiralGrooveTwist: number;
  horizontalRibCount: number;
  horizontalRibDepth: number;
  horizontalRibWidth: number;
  flutingCount: number;
  flutingDepth: number;
  rimWaveCount: number;
  rimWaveDepth: number;
  rippleCount: number;
  rippleDepth: number;
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
