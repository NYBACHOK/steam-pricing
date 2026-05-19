import { storageGet, storageSet } from "../storage";
import pricingTable from "../../pricing_table.json";

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
  console.info("[Steam Pricing] fetchPricingTable: start", { force });
  try {
    const cached = await storageGet<{ ts: number; data: PricingEntry[] }>(
      STORAGE_KEY,
    );
    if (!force && cached && Date.now() - (cached.ts || 0) < TTL) {
      console.info("[Steam Pricing] fetchPricingTable: using cached table", {
        ageMs: Date.now() - (cached.ts || 0),
        length: cached.data?.length,
      });
      return cached.data;
    }

    console.info(
      "[Steam Pricing] fetchPricingTable: loading local pricing table",
    );
    const data = pricingTable as PricingEntry[];
    console.info("[Steam Pricing] fetchPricingTable: loaded data", {
      length: data?.length,
    });
    try {
      await storageSet(STORAGE_KEY, { ts: Date.now(), data });
    } catch (e) {
      console.warn("failed to save comparing table", e);
    }
    return data;
  } catch (e) {
    console.warn("failed to load pricing table", e);
    return null;
  }
}
