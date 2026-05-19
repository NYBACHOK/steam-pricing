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
  return `
    <div class="comparison-summary">
      <div class="comparison-summary-item">
        <span class="comparison-label">USD final price:</span>
        <span class="comparison-value">${summary.usdFinalFormatted}</span>
      </div>
      <div class="comparison-summary-item">
        <span class="comparison-label">Original price (${summary.userCurrency.code}):</span>
        <span class="comparison-value">${summary.userOriginalFormatted ?? "N/A"}</span>
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
        <div><span class="comparison-label">Valve recommended final:</span> <span class="comparison-value">${recommendedFinal}</span></div>
        <div><span class="comparison-label">Valve recommended original:</span> <span class="comparison-value">${recommendedOriginal}</span></div>
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
  elements.status.textContent = "Comparison ready.";
}

function queryActiveTabMessage(): Promise<SerializedPriceCompare> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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

      chrome.tabs.sendMessage(
        tab.id,
        { type: "STEAM_PRICE_COMPARE" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[Steam Pricing] queryActiveTabMessage: message send failed",
              chrome.runtime.lastError,
            );
            resolve(null);
            return;
          }

          console.info(
            "[Steam Pricing] queryActiveTabMessage: response received",
            response,
          );
          resolve(response?.result ?? null);
        },
      );
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.info("[Steam Pricing] onMessage: received message", message);
  if (message?.type !== "STEAM_PRICE_COMPARE") {
    return false;
  }

  (async () => {
    try {
      const compareResult = await priceCompare();
      console.info(
        "[Steam Pricing] onMessage: comparison result",
        compareResult,
      );
      const rows = compareResult?.comparisons
        ? Object.fromEntries(Array.from(compareResult.comparisons))
        : null;
      sendResponse({
        result: compareResult
          ? {
              summary: compareResult.summary,
              rows,
            }
          : null,
      });
    } catch (error) {
      console.error("[Steam Pricing] onMessage: compare failed", error);
      sendResponse({ result: null });
    }
  })();

  return true;
});

if (isPopupPage()) {
  document.addEventListener("DOMContentLoaded", initPopup);
}
