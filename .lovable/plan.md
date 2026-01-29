

# Fix License Key Validation

The license key validation is failing because the `EXPORT_LICENSE_KEY` secret is not configured in the backend.

---

## The Problem

When you enter the license key `oso3d`, the edge function checks:

```
const validKey = Deno.env.get("EXPORT_LICENSE_KEY");
return validKey ? key === validKey : false;
```

Since `EXPORT_LICENSE_KEY` is not set as a secret, `validKey` is `undefined`, so the function returns `false` and proceeds to create a Stripe checkout session instead of authorizing the free download.

---

## The Fix

Add the `EXPORT_LICENSE_KEY` secret with the value `oso3d` to the backend.

---

## Technical Details

**Current secrets configured:**
- `STRIPE_SECRET_KEY` ✓

**Missing secret:**
- `EXPORT_LICENSE_KEY` (needs value: `oso3d`)

Once I add this secret, the license key validation will work and entering `oso3d` will immediately unlock the download without going to Stripe checkout.

