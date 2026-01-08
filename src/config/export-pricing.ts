export type ExportType = 'body' | 'bodyWithLegs' | 'bodyWithMold' | 'gcode' | 'batch';

export interface ExportPricing {
  priceId: string;
  unitPrice: number; // in cents
  displayPrice: string;
  description: string;
}

export const EXPORT_PRICES: Record<ExportType, ExportPricing> = {
  body: {
    priceId: 'price_1SnRWsLz2WTfSJ3nfd7fWH7C',
    unitPrice: 99,
    displayPrice: '$0.99',
    description: 'Single body STL file',
  },
  bodyWithLegs: {
    priceId: 'price_1SnRXILz2WTfSJ3nQQsQarCS',
    unitPrice: 199,
    displayPrice: '$1.99',
    description: 'Body + Legs/Base STL files',
  },
  bodyWithMold: {
    priceId: 'price_1SnRYNLz2WTfSJ3noB73i3FF',
    unitPrice: 299,
    displayPrice: '$2.99',
    description: 'Body + Ceramic mold STL files',
  },
  gcode: {
    priceId: 'price_1SnRYWLz2WTfSJ3nzSJOaVbL',
    unitPrice: 149,
    displayPrice: '$1.49',
    description: 'Print-ready G-code file',
  },
  batch: {
    priceId: 'price_1SnRYgLz2WTfSJ3nh84DlpAx',
    unitPrice: 50,
    displayPrice: '$0.50/item',
    description: 'Batch export (price per design)',
  },
};

// Calculate batch price based on item count
export const calculateBatchPrice = (itemCount: number): { cents: number; display: string } => {
  const cents = itemCount * EXPORT_PRICES.batch.unitPrice;
  const dollars = (cents / 100).toFixed(2);
  return { cents, display: `$${dollars}` };
};

// Get pricing for a specific export type
export const getPricing = (exportType: ExportType): ExportPricing => {
  return EXPORT_PRICES[exportType];
};
