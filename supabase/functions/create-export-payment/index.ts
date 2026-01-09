import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid export types
const VALID_EXPORT_TYPES = ['body', 'bodyWithLegs', 'bodyWithMold', 'gcode', 'batch'] as const;

// Price IDs for each export type
const PRICE_IDS: Record<string, string> = {
  body: 'price_1SnRWsLz2WTfSJ3nfd7fWH7C',
  bodyWithLegs: 'price_1SnRXILz2WTfSJ3nQQsQarCS',
  bodyWithMold: 'price_1SnRYNLz2WTfSJ3noB73i3FF',
  gcode: 'price_1SnRYWLz2WTfSJ3nzSJOaVbL',
  batch: 'price_1SnRYgLz2WTfSJ3nh84DlpAx',
};

// Input validation schema
const RequestSchema = z.object({
  exportType: z.enum(VALID_EXPORT_TYPES),
  itemCount: z.number().int().min(1).max(100).optional().default(1),
  email: z.string().email().max(254).optional(),
  licenseKey: z.string().max(100).optional(),
});

// Server-side license key validation (stored securely in environment)
const validateLicenseKey = (key: string | undefined): boolean => {
  if (!key) return false;
  const validKey = Deno.env.get("EXPORT_LICENSE_KEY");
  return validKey ? key === validKey : false;
};

const logStep = (step: string, details?: any) => {
  // Only log non-sensitive information
  const safeDetails = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-EXPORT-PAYMENT] ${step}${safeDetails}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[CREATE-EXPORT-PAYMENT] Stripe key not configured");
      return new Response(
        JSON.stringify({ error: "Payment service unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input with zod
    const parseResult = RequestSchema.safeParse(body);
    if (!parseResult.success) {
      logStep("Validation failed", { errors: parseResult.error.flatten().fieldErrors });
      return new Response(
        JSON.stringify({ error: "Invalid input parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { exportType, itemCount, email, licenseKey } = parseResult.data;
    logStep("Request validated", { exportType, itemCount: itemCount || 1 });

    // Check if license key is valid (server-side validation)
    if (validateLicenseKey(licenseKey)) {
      logStep("Valid license key provided");
      return new Response(
        JSON.stringify({ authorized: true, message: "License key valid" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get price ID
    const priceId = PRICE_IDS[exportType];
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "Invalid export type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For batch exports, quantity is the item count (already validated 1-100)
    const quantity = exportType === 'batch' ? itemCount : 1;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists with this email
    let customerId: string | undefined;
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing customer", { customerId });
      }
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/?export_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/?export_canceled=true`,
      metadata: {
        exportType,
        itemCount: itemCount?.toString() || '1',
      },
    });

    logStep("Checkout session created", { sessionId: session.id, exportType, quantity });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Log detailed error server-side for debugging
    console.error("[CREATE-EXPORT-PAYMENT] Error:", error);
    
    // Return generic error to client
    return new Response(
      JSON.stringify({ error: "Unable to create payment session. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
