import { storageGet, storageSet } from "../storage.ts";
import { steamGamePriceGet, GamePriceResult } from "./game_price.ts";
import type { SteamCurrency, SteamCurrencyInfo } from "./steam_currencies.ts";
import { STEAM_CURRENCY_LIST } from "./steam_currencies.ts";

const GAME_PRICE_TTL = 24 * 60 * 60 * 1000; // 1 day

const HTML_CURRENCY_ELEMENT_NAME = 'meta[itemprop="priceCurrency"]';

/**
 * Extracts the numerical AppID from a standard Steam store URL structure:
 * https://store.steampowered.com/app/{APPID}/{GAME_NAME}/
 */
function extractAppIdFromUrl(): number | null {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const m = url.match(/\/app\/(\d+)/);
  return m && m[1] ? parseInt(m[1], 10) : null;
}

export function priceCurrencyFromHtmlGet(html?: string): SteamCurrencyInfo | null {
  const doc =
    typeof html === "string"
      ? new DOMParser().parseFromString(html, "text/html")
      : document;

  const meta = doc.querySelector<HTMLMetaElement>(HTML_CURRENCY_ELEMENT_NAME);
  if (meta && meta.content) {
    const currency = meta.content.trim();
    const code =
      currency in STEAM_CURRENCY_LIST ? (currency as SteamCurrency) : null;
    return STEAM_CURRENCY_LIST[code || "USD"] || null;
  }

  return null;
}

export async function gamePriceGet(
  appId?: number | null,
  currency?: SteamCurrency | null,
): Promise<GamePriceResult | null> {
  const id = appId ?? extractAppIdFromUrl();
  if (!id) return null;

  const key = `steam_game_price_${id}`;

  try {
    const cached = await storageGet<{ ts: number; data: GamePriceResult }>(key);
    if (cached && Date.now() - (cached.ts || 0) < GAME_PRICE_TTL) {
      return cached.data;
    }
  } catch (e) {
    console.warn("storage read failed", e);
  }

  // Determine currency: prefer provided, then page meta, else USD
  let finalCurrency: SteamCurrency = "USD";
  if (currency) {
    finalCurrency = currency;
  } else {
    try {
      const meta = priceCurrencyFromHtmlGet();
      if (meta) {
        finalCurrency = meta.code;
      }
    } catch (e) {
      console.warn("failed to detect page currency", e);
    }
  }

  let result: GamePriceResult;
  try {
    result = await steamGamePriceGet(id, finalCurrency);
  } catch (err) {
    return {
      appId: id,
      isFree: false,
      priceData: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    await storageSet(key, { ts: Date.now(), data: result });
  } catch (e) {
    console.warn("failed to cache game price", e);
  }

  return result;
}
