import { ConversionMethod, PricingEntry } from "./comparison/fetch";

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
