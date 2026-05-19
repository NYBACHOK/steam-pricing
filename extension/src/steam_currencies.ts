export interface SteamCurrencyInfo {
  id: number;           
  code: SteamCurrency;        
  name: string;        
  symbol: string;    
}

/** All official currencies supported natively by Steam's regional billing engine */
export type SteamCurrency =
  | "USD"
  | "GBP"
  | "EUR"
  | "CHF"
  | "BRL"
  | "JPY"
  | "PLN"
  | "NOK"
  | "IDR"
  | "MYR"
  | "PHP"
  | "SGD"
  | "THB"
  | "VND"
  | "KRW"
  | "TRY"
  | "UAH"
  | "MXN"
  | "CAD"
  | "AUD"
  | "NZD"
  | "CNY"
  | "INR"
  | "CLP"
  | "PEN"
  | "COP"
  | "ZAR"
  | "HKD"
  | "KWD"
  | "QAR"
  | "SAR"
  | "AED"
  | "KZT"
  | "ILS"
  | "CRC"
  | "TWD"
  | "UYU";

export const STEAM_CURRENCY_LIST: Record<string, SteamCurrencyInfo> = {
  USD: { id: 1,  code: 'USD', name: 'US Dollar', symbol: '$' },
  GBP: { id: 2,  code: 'GBP', name: 'United Kingdom Pound', symbol: '£' },
  EUR: { id: 3,  code: 'EUR', name: 'Euro', symbol: '€' },
  CHF: { id: 4,  code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  PLN: { id: 6,  code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  BRL: { id: 7,  code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  JPY: { id: 8,  code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  NOK: { id: 9,  code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  IDR: { id: 10, code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  MYR: { id: 11, code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  PHP: { id: 12, code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  SGD: { id: 13, code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  THB: { id: 14, code: 'THB', name: 'Thai Baht', symbol: '฿' },
  VND: { id: 15, code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  KRW: { id: 16, code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  TRY: { id: 17, code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  UAH: { id: 18, code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  MXN: { id: 19, code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$' },
  CAD: { id: 20, code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  AUD: { id: 21, code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  NZD: { id: 22, code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  CNY: { id: 23, code: 'CNY', name: 'Chinese Yuan Renminbi', symbol: '¥' },
  INR: { id: 24, code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  CLP: { id: 25, code: 'CLP', name: 'Chilean Peso', symbol: 'CLP$' },
  PEN: { id: 26, code: 'PEN', name: 'Peruvian Sol', symbol: 'S/.' },
  COP: { id: 27, code: 'COP', name: 'Colombian Peso', symbol: 'COL$' },
  ZAR: { id: 28, code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  HKD: { id: 29, code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  KWD: { id: 30, code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD' },
  QAR: { id: 31, code: 'QAR', name: 'Qatari Riyal', symbol: 'QR' },
  SAR: { id: 32, code: 'SAR', name: 'Saudi Riyal', symbol: 'SR' },
  AED: { id: 34, code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  TWD: { id: 35, code: 'TWD', name: 'Taiwan New Dollar', symbol: 'NT$' },
  KZT: { id: 37, code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸' },
  ILS: { id: 38, code: 'ILS', name: 'Israeli New Shekel', symbol: '₪' },
  CRC: { id: 40, code: 'CRC', name: 'Costa Rican Colon', symbol: '₡' },
  UYU: { id: 41, code: 'UYU', name: 'Uruguayan Peso', symbol: '$U' }
};

export function priceCurrencyFromHtmlGet(html?: string): SteamCurrencyInfo | null {
  const doc = typeof html === "string"
    ? new DOMParser().parseFromString(html, "text/html")
    : document;

  const meta = doc.querySelector<HTMLMetaElement>(
    'meta[itemprop="priceCurrency"]',
  );
  if (meta && meta.content) {
    const currency = meta.content.trim();
    const code =  currency in STEAM_CURRENCY_LIST ? (currency as SteamCurrency) : null;
    return STEAM_CURRENCY_LIST[code || 'USD'] || null
  }

  return null;
}
