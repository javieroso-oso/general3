import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema - Stripe session IDs start with "cs_"
const RequestSchema = z.object({
  sessionId: z.string()
    .min(10, "Session ID too short")
    .max(200, "Session ID too long")
    .regex(/^cs_/, "Invalid session ID format"),
});

const logStep = (step: string, details?: any) => {
  // Only log non-sensitive information
  const safeDetails = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${safeDetails}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[VERIFY-PAYMENT] Stripe key not configured");
      return new Response(
        JSON.stringify({ error: "Payment service unavailable", verified: false }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body", verified: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input
    const parseResult = RequestSchema.safeParse(body);
    if (!parseResult.success) {
      logStep("Validation failed");
      return new Response(
        JSON.stringify({ error: "Invalid session ID", verified: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sessionId } = parseResult.data;
    logStep("Request validated");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { 
      paymentStatus: session.payment_status,
      status: session.status 
    });

    const isPaid = session.payment_status === "paid" && session.status === "complete";

    return new Response(JSON.stringify({ 
      verified: isPaid,
      paymentStatus: session.payment_status,
      itemCount: session.metadata?.itemCount 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Log detailed error server-side for debugging
    console.error("[VERIFY-PAYMENT] Error:", error);
    
    // Return generic error to client
    return new Response(
      JSON.stringify({ error: "Unable to verify payment. Please try again.", verified: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
