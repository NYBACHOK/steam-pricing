import { storageGet, storageSet } from "../storage";

  const PRICING_TABLE =
  "https://raw.githubusercontent.com/NYBACHOK/steam-pricing/master/pricing_table.json";

export const STORAGE_KEY = "steam_pricing_cache_v1";
export const TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export type ConversionMethod = 1 | 2 | 3;

export type PricingEntry = {
  usd_price?: number;
  currency_prices?: Array<{ currency_code: number; price: number }>;
  region_prices?: Array<any>;
  convert_method?: number;
};

export async function fetchPricingTable(
  force = false,
): Promise<PricingEntry[] | null> {
  try {
    const cached = await storageGet<{ ts: number; data: PricingEntry[] }>(
      STORAGE_KEY,
    );
    if (!force && cached && Date.now() - (cached.ts || 0) < TTL) {
      return cached.data;
    }

    const resp = await fetch(PRICING_TABLE);
    if (!resp.ok) return null;
    const data = (await resp.json()) as PricingEntry[];
   try {
 await storageSet(STORAGE_KEY, { ts: Date.now(), data });
   }catch (e) {
     console.warn("failed to save comparing table", e);
   }
    return data;
  } catch (e) {
    console.warn("failed to fetch pricing table", e);
    return null;
  }
}