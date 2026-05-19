import { gamePriceGet, priceCurrencyFromHtmlGet } from "../pricing/pricing";
import type { SteamCurrencyInfo } from "../pricing/steam_currencies.ts";
import { ConversionMethod, fetchPricingTable, PricingEntry } from "./fetch";

export type ComparingResult = {
  discount_diff: number;
  original_diff: number;
  recommended_final_price: number | null;
  recommended_original_price: number | null;
};

export type PriceCompareSummary = {
  usdFinalFormatted: string;
  usdOriginalFormatted: string | null;
  userFinalFormatted: string;
  userOriginalFormatted: string | null;
  userCurrency: SteamCurrencyInfo;
};

export type PriceCompareResult = {
  summary: PriceCompareSummary;
  comparisons: Map<ConversionMethod, ComparingResult>;
};

function findTableEntry(
  table: PricingEntry[] | null,
  usdPrice: number,
  method: ConversionMethod,
): PricingEntry | null {
  if (!table || table.length === 0) {
    return null;
  }

  const candidates = table.filter(
    (entry) =>
      (entry.convert_method ?? 3) === method && entry.usd_price != null,
  );
  if (candidates.length === 0) {
    return null;
  }

  const exact = candidates.find((entry) => entry.usd_price === usdPrice);
  if (exact) {
    return exact;
  }

  return candidates.reduce((best, entry) => {
    const bestUsd = best.usd_price ?? 0;
    const currentUsd = entry.usd_price ?? 0;
    const bestDiff = Math.abs(bestUsd - usdPrice);
    const currentDiff = Math.abs(currentUsd - usdPrice);

    if (currentDiff < bestDiff) {
      return entry;
    }

    if (currentDiff === bestDiff) {
      return currentUsd > bestUsd ? entry : best;
    }

    return best;
  }, candidates[0]);
}

function extractLocalPrice(
  entry: PricingEntry | null,
  currencyId: number,
): number | null {
  if (!entry || !entry.currency_prices) {
    return null;
  }

  const match = entry.currency_prices.find(
    (current) => current.currency_code === currencyId,
  );
  if (!match || match.price == null) {
    return null;
  }

  return match.price;
}

function percentDiff(actual: number, expected: number | null): number {
  if (!expected || expected === 0) {
    return 0;
  }

  return Math.round(((actual - expected) / expected) * 100);
}

export async function priceCompare(
  appId?: number | null,
): Promise<PriceCompareResult | null> {
  console.info("[Steam Pricing] priceCompare: starting comparison", { appId });
  const user_currency = priceCurrencyFromHtmlGet();
  console.info(
    "[Steam Pricing] priceCompare: detected user currency",
    user_currency,
  );
  if (!user_currency) {
    console.warn(
      "[Steam Pricing] priceCompare: failed to detect user currency from page",
    );
    return null;
  }

  const [price_in_user_currency, price_in_usd, table] = await Promise.all([
    gamePriceGet(appId, user_currency.code),
    gamePriceGet(appId, "USD"),
    fetchPricingTable(),
  ]);

  console.info("[Steam Pricing] priceCompare: fetched prices and table", {
    price_in_user_currency,
    price_in_usd,
    table_length: table?.length ?? null,
  });

  if (!price_in_user_currency || !price_in_user_currency.priceData) {
    console.warn(
      "[Steam Pricing] priceCompare: missing user currency price data",
    );
    return null;
  }

  if (!price_in_usd || !price_in_usd.priceData) {
    console.warn("[Steam Pricing] priceCompare: missing USD price data");
    return null;
  }

  if (!table) {
    console.warn("[Steam Pricing] priceCompare: pricing table unavailable");
    return null;
  }

  const userFinal = price_in_user_currency.priceData.final;
  const userOriginal = price_in_user_currency.priceData.initial;
  const usdFinal = price_in_usd.priceData.final;
  const usdOriginal = price_in_usd.priceData.initial;

  console.info("[Steam Pricing] priceCompare: comparing values", {
    userFinal,
    userOriginal,
    usdFinal,
    usdOriginal,
  });

  const summary: PriceCompareSummary = {
    usdFinalFormatted: price_in_usd.priceData.final_formatted,
    usdOriginalFormatted: price_in_usd.priceData.initial_formatted || null,
    userFinalFormatted: price_in_user_currency.priceData.final_formatted,
    userOriginalFormatted:
      price_in_user_currency.priceData.initial_formatted || null,
    userCurrency: user_currency,
  };

  const methods: ConversionMethod[] = [1, 2, 3];
  const comparisons = new Map<ConversionMethod, ComparingResult>();

  for (const method of methods) {
    const finalEntry = findTableEntry(table, usdFinal, method);
    const expectedFinal = extractLocalPrice(finalEntry, user_currency.id);
    const discount_diff = percentDiff(userFinal, expectedFinal);

    let original_diff = 0;
    let expectedOriginal: number | null = null;
    if (userOriginal != null && usdOriginal != null) {
      const originalEntry = findTableEntry(table, usdOriginal, method);
      expectedOriginal = extractLocalPrice(originalEntry, user_currency.id);
      original_diff = percentDiff(userOriginal, expectedOriginal);
    }

    console.info("[Steam Pricing] priceCompare: method result", {
      method,
      expectedFinal,
      expectedOriginal,
      discount_diff,
      original_diff,
    });

    comparisons.set(method, {
      discount_diff,
      original_diff,
      recommended_final_price: expectedFinal,
      recommended_original_price: expectedOriginal,
    });
  }

  return { summary, comparisons };
}
