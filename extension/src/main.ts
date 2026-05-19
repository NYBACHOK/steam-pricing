import "webextension-polyfill";
import {
  getConversionMethodDescription,
  getConversionMethodName,
} from "./utils.ts";
import {
  priceCompare,
  ComparingResult,
  PriceCompareSummary,
} from "./comparison/compare.ts";
import { ConversionMethod } from "./comparison/fetch.ts";
import Browser from "webextension-polyfill";

type SerializedPriceCompare = {
  summary: PriceCompareSummary;
  rows: Record<string, ComparingResult> | null;
} | null;

type PopupElements = {
  status: HTMLElement;
  results: HTMLElement;
};

function isPopupPage(): boolean {
  return document.getElementById("steam-pricing-popup-root") !== null;
}

function extractAppIdFromActiveTab(url: string): number | null {
  const m = url.match(/\/app\/(\d+)/);
  return m && m[1] ? parseInt(m[1], 10) : null;
}

function formatLocalPrice(value: number | null, symbol: string): string {
  if (value == null) {
    return "N/A";
  }

  const amount = value / 100;
  const formatted = Number.isInteger(amount)
    ? amount.toFixed(0)
    : amount.toFixed(2);
  return `${symbol}${formatted}`;
}

function renderSummary(summary: PriceCompareSummary): string {
  const userOriginalDisplay =
    summary.userOriginalFormatted ||
    formatLocalPrice(summary.userOriginal, summary.userCurrency.symbol) ||
    "N/A";
  const usdOriginalDisplay =
    summary.usdOriginalFormatted ||
    formatLocalPrice(summary.usdOriginal, "$") ||
    "N/A";

  return `
    <div class="comparison-summary">
      <div class="comparison-summary-item">
        <span class="comparison-label">USD final price:</span>
        <span class="comparison-value">${usdOriginalDisplay || "N/A"}</span>
      </div>
      <div class="comparison-summary-item">
        <span class="comparison-label">Original price (${summary.userCurrency.code}):</span>
        <span class="comparison-value">${userOriginalDisplay}</span>
      </div>
    </div>
  `;
}

function renderRow(
  method: ConversionMethod,
  result: ComparingResult,
  currencySymbol: string,
): string {
  const title = getConversionMethodName(method);
  const description = getConversionMethodDescription(method);
  const discount =
    result.discount_diff >= 0
      ? `+${result.discount_diff}%`
      : `${result.discount_diff}%`;
  const original =
    result.original_diff >= 0
      ? `+${result.original_diff}%`
      : `${result.original_diff}%`;
  const recommendedFinal = formatLocalPrice(
    result.recommended_final_price,
    currencySymbol,
  );
  const recommendedOriginal = formatLocalPrice(
    result.recommended_original_price,
    currencySymbol,
  );

  return `
    <div class="comparison-card">
      <div class="comparison-card-header">${title}</div>
      <div class="comparison-card-description">${description}</div>
      <div class="comparison-card-values">
        <div><span class="comparison-label">Discount diff:</span> <span class="comparison-value">${discount}</span></div>
        <div><span class="comparison-label">Original diff:</span> <span class="comparison-value">${original}</span></div>
        <div><span class="comparison-label">Valve final:</span> <span class="comparison-value">${recommendedFinal}</span></div>
        <div><span class="comparison-label">Valve original:</span> <span class="comparison-value">${recommendedOriginal}</span></div>
      </div>
    </div>
  `;
}

function renderComparison(
  result: SerializedPriceCompare,
  elements: PopupElements,
) {
  if (!result || !result.rows || !result.summary) {
    elements.status.textContent =
      "Unable to compare prices. Please open a Steam app page first.";
    return;
  }

  const rows = result.rows ?? {};
  const sortedMethods = Object.keys(rows)
    .map((key) => Number(key) as ConversionMethod)
    .sort((a, b) => a - b);

  elements.results.innerHTML = `
    ${renderSummary(result.summary)}
    ${sortedMethods
      .map((method) => {
        const row = rows[method.toString()];
        if (!row) {
          return "";
        }
        return renderRow(method, row, result.summary.userCurrency.symbol);
      })
      .join("\n")}
  `;
  elements.status.textContent = "";
}

function queryActiveTabMessage(): Promise<SerializedPriceCompare> {
  return new Promise((resolve) => {
    Browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      console.info(
        "[Steam Pricing] queryActiveTabMessage: tabs returned",
        tabs,
      );
      const tab = tabs[0];
      if (!tab?.id) {
        console.warn(
          "[Steam Pricing] queryActiveTabMessage: no active tab or missing tab id",
        );
        resolve(null);
        return;
      }

      const url = tab.url;
      if (!url) {
        console.warn(
          "[Steam Pricing] queryActiveTabMessage: missing permission for url retrieval",
        );
        resolve(null);
        return;
      }

      Browser.tabs
        .sendMessage(tab.id, { type: "STEAM_PRICE_COMPARE", url: url })
        .then((response: any) => {
          console.info(
            "[Steam Pricing] queryActiveTabMessage: response received",
            response,
          );
          resolve(response?.result ?? null);
        })
        .catch((error) => {
          console.error(
            "[Steam Pricing] queryActiveTabMessage: message send failed",
            error,
          );
          resolve(null);
        });
    });
  });
}

async function initPopup() {
  const status = document.getElementById("status");
  const results = document.getElementById("results");
  if (!status || !results) return;

  status.textContent =
    "Requesting price comparison from the active Steam tab...";
  const result = await queryActiveTabMessage();
  renderComparison(result, { status, results });
}

Browser.runtime.onMessage.addListener(async (message: any) => {
  console.info("[Steam Pricing] onMessage: received message", message);
  if (message?.type !== "STEAM_PRICE_COMPARE") {
    return;
  }

  try {
    const appId = extractAppIdFromActiveTab(message.url ?? "");
    if (!appId) {
      console.warn(
        "[Steam Pricing] gamePriceGet: missing appId and unable to extract from URL",
      );
      return { result: null };
    }

    const compareResult = await priceCompare(appId);
    console.info("[Steam Pricing] onMessage: comparison result", compareResult);
    const rows = compareResult?.comparisons
      ? Object.fromEntries(Array.from(compareResult.comparisons))
      : null;
    return {
      result: compareResult
        ? {
            summary: compareResult.summary,
            rows,
          }
        : null,
    };
  } catch (error) {
    console.error("[Steam Pricing] onMessage: compare failed", error);
    return { result: null };
  }
});

if (isPopupPage()) {
  document.addEventListener("DOMContentLoaded", initPopup);
}
