# Plan: Implement Dynamic Pricing Based on Export Type

## Current Situation

### What Exists Now
- **Single Stripe Price**: `price_1SjaIqLz2WTfSJ3nkdA3FLhK` = $2.99 (one-time)
- **Single Product**: `prod_TgyFLCAEaflU1o` = "STL Batch Export"
- **Fixed display price**: Hardcoded `$2.99` in `ExportPaymentDialog.tsx` (line 95)
- **Edge function**: Uses hardcoded price ID in `create-export-payment/index.ts` (line 52)

### Export Types Available
| Export Type | Description | Current Price |
|-------------|-------------|---------------|
| Body STL | Single body mesh | $2.99 |
| Legs/Base STL | Legs and base mesh | $2.99 |
| All Parts | Body + Legs combined | $2.99 |
| G-code | Print-ready file | $2.99 |
| Mold (ceramic) | Mold for slip casting | $2.99 |
| Batch (drawer) | Multiple designs as ZIP | $2.99 |

---

## Implementation Plan: Dynamic Pricing System

### Part 1: Create Multiple Stripe Prices

You'll need to create different prices in Stripe for each export tier. I can create these for you:

| Export Type | Suggested Price | Product Name |
|-------------|-----------------|--------------|
| Single Body STL | $0.99 | Single Body Export |
| Body + Legs | $1.99 | Body with Legs Export |
| Body + Ceramic Mold | $2.99 | Body with Mold Export |
| G-code | $1.49 | G-code Export |
| Batch Export (per item) | $0.50/item | Batch Export |

### Part 2: Create Pricing Configuration File

#### New file: `src/config/export-pricing.ts`

```typescript
export interface ExportPricing {
  priceId: string;
  displayPrice: string;
  description: string;
}

export const EXPORT_PRICES: Record<string, ExportPricing> = {
  body: {
    priceId: 'price_BODY_ID',
    displayPrice: '$0.99',
    description: 'Single body STL file',
  },
  bodyWithLegs: {
    priceId: 'price_BODY_LEGS_ID',
    displayPrice: '$1.99',
    description: 'Body + Legs/Base STL files',
  },
  bodyWithMold: {
    priceId: 'price_MOLD_ID',
    displayPrice: '$2.99',
    description: 'Body + Ceramic mold STL files',
  },
  gcode: {
    priceId: 'price_GCODE_ID',
    displayPrice: '$1.49',
    description: 'Print-ready G-code file',
  },
  batch: {
    priceId: 'price_BATCH_ID',
    displayPrice: '$0.50/item',
    description: 'Batch export (price per design)',
  },
};

// Helper to calculate batch price
export const calculateBatchPrice = (itemCount: number): number => {
  return itemCount * 0.50;
};
```

### Part 3: Update Edge Function for Dynamic Pricing

#### Modify: `supabase/functions/create-export-payment/index.ts`

Changes needed:
1. Accept `exportType` in request body (not just `itemCount`)
2. Use `price_data` for dynamic batch pricing OR select correct price ID
3. Support quantity-based pricing for batch exports

```typescript
// Updated request parsing
const { itemCount, email, exportType } = await req.json();

// Price selection logic
let priceId: string;
let quantity = 1;

switch (exportType) {
  case 'body':
    priceId = 'price_BODY_ID';
    break;
  case 'bodyWithLegs':
    priceId = 'price_BODY_LEGS_ID';
    break;
  case 'bodyWithMold':
    priceId = 'price_MOLD_ID';
    break;
  case 'gcode':
    priceId = 'price_GCODE_ID';
    break;
  case 'batch':
    priceId = 'price_BATCH_ID';
    quantity = itemCount;
    break;
  default:
    priceId = 'price_DEFAULT_ID';
}

// Create session with dynamic price
const session = await stripe.checkout.sessions.create({
  // ... existing config
  line_items: [{ price: priceId, quantity }],
});
```

### Part 4: Update ExportPaymentDialog Component

#### Modify: `src/components/ExportPaymentDialog.tsx`

Changes needed:
1. Accept `exportType` prop with more specific values
2. Import and use pricing config
3. Display dynamic price based on export type
4. Pass `exportType` to edge function

```typescript
interface ExportPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  exportType: 'body' | 'bodyWithLegs' | 'bodyWithMold' | 'gcode' | 'batch';
  itemCount?: number;
}

// Inside component
const pricing = EXPORT_PRICES[exportType];
const displayPrice = exportType === 'batch' 
  ? `$${calculateBatchPrice(itemCount).toFixed(2)}` 
  : pricing.displayPrice;

// Update payment call
const { data, error } = await supabase.functions.invoke('create-export-payment', {
  body: { itemCount, exportType },
});
```

### Part 5: Update Index.tsx Export Handlers

#### Modify: `src/pages/Index.tsx`

Changes needed:
1. Update `pendingExportType` to use more specific values
2. Pass correct export type to dialog based on what user is exporting

```typescript
// Determine export type based on params
const getExportType = useCallback(() => {
  if (params.addLegs) return 'bodyWithLegs';
  if (params.generateMold) return 'bodyWithMold';
  return 'body';
}, [params.addLegs, params.generateMold]);

// In handleExportBody
setPendingExportType(getExportType());
```

---

## How to Change Prices

### Option A: Change Price in Stripe Dashboard (Recommended)

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products)
2. Find the product you want to modify
3. Click "Add price" to create a new price, or archive old price
4. Update the price ID in `src/config/export-pricing.ts`
5. Update the display price in the same file

### Option B: Use Stripe API (via Lovable tools)

I can create new products/prices for you using Stripe tools. Just tell me:
- What export types you want
- What price for each

### Option C: Dynamic Pricing with price_data

For fully dynamic pricing (e.g., batch per-item), use `price_data` instead of a price ID:

```typescript
line_items: [{
  price_data: {
    currency: 'usd',
    product: 'prod_TgyFLCAEaflU1o',
    unit_amount: 50, // $0.50 in cents
  },
  quantity: itemCount,
}],
```

---

## Quick Reference: Where to Edit

| What to Change | File | Line(s) |
|----------------|------|---------|
| Display prices | `src/config/export-pricing.ts` | All prices defined here |
| Stripe price IDs | `src/config/export-pricing.ts` | `priceId` fields |
| Batch pricing formula | `src/config/export-pricing.ts` | `calculateBatchPrice()` |
| Edge function price logic | `supabase/functions/create-export-payment/index.ts` | Switch statement |
| UI dialog | `src/components/ExportPaymentDialog.tsx` | Uses config file |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/config/export-pricing.ts` | **CREATE** - Centralized pricing configuration |
| `supabase/functions/create-export-payment/index.ts` | **MODIFY** - Accept exportType, select correct price |
| `src/components/ExportPaymentDialog.tsx` | **MODIFY** - Show dynamic prices from config |
| `src/pages/Index.tsx` | **MODIFY** - Pass correct export type based on params |

---

## Recommended Next Steps

1. **Decide on pricing tiers**: What should each export type cost?
2. **Create Stripe prices**: I can create these for you via tools
3. **Implement the changes**: Create config file and update components
4. **Test the flow**: Verify each export type shows correct price

Would you like me to create specific Stripe prices for your export types before implementing?
