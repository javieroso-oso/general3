import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Price IDs for each export type
const PRICE_IDS: Record<string, string> = {
  body: 'price_1SnRWsLz2WTfSJ3nfd7fWH7C',
  bodyWithLegs: 'price_1SnRXILz2WTfSJ3nQQsQarCS',
  bodyWithMold: 'price_1SnRYNLz2WTfSJ3noB73i3FF',
  gcode: 'price_1SnRYWLz2WTfSJ3nzSJOaVbL',
  batch: 'price_1SnRYgLz2WTfSJ3nh84DlpAx',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-EXPORT-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const { exportType, itemCount, email } = await req.json();
    logStep("Request parsed", { exportType, itemCount, email });

    // Validate export type
    const priceId = PRICE_IDS[exportType];
    if (!priceId) {
      throw new Error(`Invalid export type: ${exportType}`);
    }

    // For batch exports, quantity is the item count
    const quantity = exportType === 'batch' ? (itemCount || 1) : 1;

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

    logStep("Checkout session created", { sessionId: session.id, url: session.url, exportType, quantity });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
