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

export function priceCurrencyFromHtmlGet(
  html?: string,
): SteamCurrencyInfo | null {
  const doc =
    typeof html === "string"
      ? new DOMParser().parseFromString(html, "text/html")
      : document;

  const meta = doc.querySelector<HTMLMetaElement>(HTML_CURRENCY_ELEMENT_NAME);
  if (meta && meta.content) {
    const currency = meta.content.trim();
    const code =
      currency in STEAM_CURRENCY_LIST ? (currency as SteamCurrency) : null;
    const detected = STEAM_CURRENCY_LIST[code || "USD"] || null;
    console.info(
      "[Steam Pricing] priceCurrencyFromHtmlGet: detected currency meta",
      {
        metaContent: meta.content,
        currency,
        code,
        detected,
      },
    );
    return detected;
  }

  console.warn(
    "[Steam Pricing] priceCurrencyFromHtmlGet: currency meta tag not found or empty",
  );
  return null;
}

export async function gamePriceGet(
  appId?: number | null,
  currency?: SteamCurrency | null,
): Promise<GamePriceResult | null> {
  const id = appId ?? extractAppIdFromUrl();
  if (!id) {
    console.warn(
      "[Steam Pricing] gamePriceGet: missing appId and unable to extract from URL",
    );
    return null;
  }

  let finalCurrency: SteamCurrency = "USD";
  if (currency) {
    finalCurrency = currency;
    console.info(
      "[Steam Pricing] gamePriceGet: using provided currency",
      finalCurrency,
    );
  } else {
    try {
      const meta = priceCurrencyFromHtmlGet();
      if (meta) {
        finalCurrency = meta.code;
        console.info(
          "[Steam Pricing] gamePriceGet: inferred currency from page meta",
          finalCurrency,
        );
      } else {
        console.info(
          "[Steam Pricing] gamePriceGet: defaulting to USD because no currency meta was found",
        );
      }
    } catch (e) {
      console.warn(
        "[Steam Pricing] gamePriceGet: failed to detect page currency",
        e,
      );
    }
  }

  const key = `steam_game_price_${id}_${finalCurrency}`;
  console.info("[Steam Pricing] gamePriceGet: start", {
    appId: id,
    requestedCurrency: finalCurrency,
  });

  try {
    const cached = await storageGet<{ ts: number; data: GamePriceResult }>(key);
    if (cached && Date.now() - (cached.ts || 0) < GAME_PRICE_TTL) {
      console.info("[Steam Pricing] gamePriceGet: using cached price", {
        key,
        ageMs: Date.now() - (cached.ts || 0),
        cachedData: cached.data,
      });
      return cached.data;
    }
  } catch (e) {
    console.warn("[Steam Pricing] gamePriceGet: storage read failed", e);
  }

  let result: GamePriceResult;
  try {
    result = await steamGamePriceGet(id, finalCurrency);
    console.info(
      "[Steam Pricing] gamePriceGet: steamGamePriceGet returned",
      result,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Steam Pricing] gamePriceGet: steamGamePriceGet threw", err);
    return {
      appId: id,
      isFree: false,
      priceData: null,
      error: message,
    };
  }

  try {
    await storageSet(key, { ts: Date.now(), data: result });
    console.info("[Steam Pricing] gamePriceGet: cached price result", { key });
  } catch (e) {
    console.warn("[Steam Pricing] gamePriceGet: failed to cache game price", e);
  }

  return result;
}
