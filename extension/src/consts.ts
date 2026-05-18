export const PRICING_TABLE =
  "https://raw.githubusercontent.com/NYBACHOK/steam-pricing/master/pricing_table.json";

export const CURRENCY_MAP: Record<string, number> = {
  $: 1, // USD
  "£": 2, // GBP
  "€": 3, // EUR
  CHF: 4, // CHF
  zł: 6, // PLN
  R$: 7, // BRL
  "¥": 8, // JPY / CNY
  Rp: 10, // IDR
  RM: 11, // MYR
  "₱": 12, // PHP
  S$: 13, // SGD
  "฿": 14, // THB
  "₫": 15, // VND
  "₩": 16, // KRW
  "₺": 17, // TRY
  "₴": 18, // UAH
  Mex$: 19, // MXN
  CDN$: 20, // CAD
  A$: 21, // AUD
  NZ$: 22, // NZD
  "₹": 24, // INR
  CLP$: 25, // CLP
  "S/.": 26, // PEN
  COL$: 27, // COP
  R: 28, // ZAR
  HK$: 29, // HKD
  NT$: 30, // TWD
  SR: 31, // SAR
  AED: 32, // AED
  ARS$: 34, // ARS
  "₪": 35, // ILS
  "₸": 37, // KZT
  KD: 38, // KWD
  QR: 39, // QAR
  "₡": 40, // CRC
  $U: 41, // UYU
};

export const STORAGE_KEY = "steam_pricing_cache_v1";
export const STORAGE_KEY_CONFIG = "steam_pricing_config_v1";
export const TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
