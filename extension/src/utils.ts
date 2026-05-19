import { ConversionMethod } from "./types";

export function getConversionMethodName(method: ConversionMethod): string {
  switch (method) {
    case 1:
      return "Raw Conversion";
    case 2:
      return "Purchase Power";
    case 3:
      return "Default Multi Variable";
    default:
      return "Unknown";
  }
}

export function getConversionMethodDescription(
  method: ConversionMethod,
): string {
  switch (method) {
    case 1:
      return "Direct currency conversion based on exchange rates.";
    case 2:
      return "Adjusted using regional purchasing power parity.";
    case 3:
      return "Valve default pricing model using multiple variables.";
    default:
      return "";
  }
}

export function extractCurrencySymbol(text: string): string | null {
  if (!text) return null;
  const symbol = text.replace(/[0-9.,\s\u00A0-]/g, "").trim();
  return symbol || null;
}

const PRICE_SELECTORS = [
  ".discount_final_price",
  ".game_purchase_price",
  ".price",
];

export function currencyFromPageGet(html?: string): string | null {
  const isHtmlString = typeof html === "string";
  const doc = isHtmlString
    ? new DOMParser().parseFromString(html, "text/html")
    : document;

  for (const selector of PRICE_SELECTORS) {
    const element = doc.querySelector<HTMLElement>(selector);
    if (!element) continue;

    if (isHtmlString || element.offsetParent !== null) {
      const currency = extractCurrencySymbol(element.textContent || "");
      if (currency) return currency;
    }
  }

  const fallbackElements = Array.from(
    doc.querySelectorAll<HTMLElement>('[class*="price"]'),
  );

  for (const element of fallbackElements) {
    if (isHtmlString || element.offsetParent !== null) {
      const currency = extractCurrencySymbol(element.textContent || "");
      if (currency) return currency;
    }
  }

  return null;
}
