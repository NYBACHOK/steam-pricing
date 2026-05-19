import { SteamCurrency } from "./steam_currencies";

/**
 * Maps all supported Steam ISO currencies to an ideal country code ('cc')
 * to force Steam's regional store engine to return that localized currency.
 *
 * This more for future if I add setting for currency selection.
 * By default Steam returns currency based on your IP
 */
const CURRENCY_TO_COUNTRY_MAP: Record<SteamCurrency, string> = {
  USD: "us", // United States Dollar
  GBP: "gb", // British Pound
  EUR: "de", // Euro (Germany used as baseline Euro zone)
  CHF: "ch", // Swiss Franc
  BRL: "br", // Brazilian Real
  JPY: "jp", // Japanese Yen
  NOK: "no", // Norwegian Krone
  IDR: "id", // Indonesian Rupiah
  MYR: "my", // Malaysian Ringgit
  PHP: "ph", // Philippine Peso
  SGD: "sg", // Singapore Dollar
  THB: "th", // Thai Baht
  VND: "vn", // Vietnamese Dong
  KRW: "kr", // South Korean Won
  TRY: "tr", // Turkish Lira
  UAH: "ua", // Ukrainian Hryvnia
  MXN: "mx", // Mexican Peso
  CAD: "ca", // Canadian Dollar
  AUD: "au", // Australian Dollar
  NZD: "nz", // New Zealand Dollar
  CNY: "cn", // Chinese Yuan
  INR: "in", // Indian Rupee
  CLP: "cl", // Chilean Peso
  PEN: "pe", // Peruvian Sol
  COP: "co", // Colombian Peso
  ZAR: "za", // South African Rand
  HKD: "hk", // Hong Kong Dollar
  KWD: "kw", // Kuwaiti Dinar
  QAR: "qa", // Qatari Riyal
  SAR: "sa", // Saudi Riyal
  AED: "ae", // United Arab Emirates Dirham
  KZT: "kz", // Kazakhstani Tenge
  ILS: "il", // Israeli New Shekel
  CRC: "cr", // Costa Rican Colón
  UYU: "uy", // Uruguayan Peso
  PLN: "pl", // Polish zloty
  TWD: "tw", // Taiwan New Dollar
};

export interface SteamPriceOverview {
  currency: SteamCurrency;
  initial: number; // Price in cents/lowest denomination (e.g., 999 = $9.99)
  final: number; // Discounted price in cents/lowest denomination
  discount_percent: number;
  initial_formatted: string; // Formatted with sign
  final_formatted: string; // Formatted with sign
}

interface SteamAppDetailsSuccess {
  success: true;
  data: {
    price_overview?: SteamPriceOverview;
    is_free?: boolean;
  };
}

interface SteamAppDetailsFailure {
  success: false;
}

type SteamAppDetailsResponse = Record<
  string,
  SteamAppDetailsSuccess | SteamAppDetailsFailure
>;

export interface GamePriceResult {
  appId: number;
  isFree: boolean;
  priceData: SteamPriceOverview | null;
  error?: string;
}

/**
 * Fetches current price overview data for a specific Steam game ID and localizes currency.
 *
 * @param appId The numerical identifier of the Steam application (e.g., 400 for Portal)
 * @param currency Target 3-letter ISO currency structure
 */
export async function steamGamePriceGet(
  appId: number,
  currency: SteamCurrency,
): Promise<GamePriceResult> {
  const countryCode = CURRENCY_TO_COUNTRY_MAP[currency] || "us";

  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.append("appids", appId.toString());
  url.searchParams.append("cc", countryCode);
  url.searchParams.append("filters", "price_overview");

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "TypeScript-Steam-Price-Fetcher/1.0" },
    });

    if (!response.ok) {
      return {
        appId,
        isFree: false,
        priceData: null,
        error: `HTTP network failure: ${response.status}`,
      };
    }

    const rawData = (await response.json()) as SteamAppDetailsResponse;
    const appKey = appId.toString();
    const appPayload = rawData[appKey];

    if (!appPayload || !appPayload.success) {
      return {
        appId,
        isFree: false,
        priceData: null,
        error: "Steam returned unsuccessful data flags or App ID not found",
      };
    }

    const data = appPayload.data;

    // Free to Play games omit the price_overview object entirely
    if (!data.price_overview) {
      return {
        appId,
        isFree: true,
        priceData: null,
      };
    }

    return {
      appId,
      isFree: false,
      priceData: data.price_overview,
    };
  } catch (err) {
    return {
      appId,
      isFree: false,
      priceData: null,
      error:
        err instanceof Error
          ? err.message
          : "Unknown runtime exception occurred",
    };
  }
}
