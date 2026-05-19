import { gamePriceGet, priceCurrencyFromHtmlGet } from "../pricing/pricing";
import { ConversionMethod, fetchPricingTable, PricingEntry } from "./fetch";

export type ComparingResult = {
  discount_diff: number;
  original_diff: number;
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
    (entry) => (entry.convert_method ?? 3) === method && entry.usd_price != null,
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
): Promise<Map<ConversionMethod, ComparingResult> | null> {
  const user_currency = priceCurrencyFromHtmlGet();
  if (!user_currency) {
    return null;
  }

  const [price_in_user_currency, price_in_usd, table] = await Promise.all([
    gamePriceGet(appId, user_currency.code),
    gamePriceGet(appId, "USD"),
    fetchPricingTable(),
  ]);

  if (
    !price_in_user_currency ||
    !price_in_user_currency.priceData ||
    !price_in_usd ||
    !price_in_usd.priceData ||
    !table
  ) {
    return null;
  }

  const userFinal = price_in_user_currency.priceData.final;
  const userOriginal = price_in_user_currency.priceData.initial;
  const usdFinal = price_in_usd.priceData.final;
  const usdOriginal = price_in_usd.priceData.initial;

  const methods: ConversionMethod[] = [1, 2, 3];
  const result = new Map<ConversionMethod, ComparingResult>();

  for (const method of methods) {
    const finalEntry = findTableEntry(table, usdFinal, method);
    const expectedFinal = extractLocalPrice(finalEntry, user_currency.id);
    const discount_diff = percentDiff(userFinal, expectedFinal);

    let original_diff = 0;
    if (userOriginal != null && usdOriginal != null) {
      const originalEntry = findTableEntry(table, usdOriginal, method);
      const expectedOriginal = extractLocalPrice(
        originalEntry,
        user_currency.id,
      );
      original_diff = percentDiff(userOriginal, expectedOriginal);
    }

    result.set(method, {
      discount_diff,
      original_diff,
    });
  }

  return result;
}
