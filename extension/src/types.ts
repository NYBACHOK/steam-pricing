export type ConversionMethod = 1 | 2 | 3;

export type PricingEntry = {
  usd_price?: number;
  currency_prices?: Array<{ currency_code: number; price: number }>;
  region_prices?: Array<any>;
  convert_method?: number;
};

export interface PagePrice {
  finalPrice: number;
  finalRaw: string;
  originalPrice: number | null;
  originalRaw: string | null;
  symbol: string | null;
}

export interface ComparisonResult {
  entry: PricingEntry | null;
  price: number | null;
  percentFinal: number | null;
  percentOrig: number | null;
  currencyCode?: number | null; // Tracks the ID of the currency used in comparison
}

export interface ComparisonPage {
  method: ConversionMethod;
  title: string;
  description: string;
  result: ComparisonResult;
}
