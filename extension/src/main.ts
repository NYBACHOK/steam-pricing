import {
  CURRENCY_MAP,
  PRICING_TABLE,
  STORAGE_KEY,
  STORAGE_KEY_CONFIG,
  TTL,
} from "./consts.ts";
import { getConfig, storageGet, storageSet } from "./storage.ts";
import {
  ConversionMethod,
  PricingEntry,
  PagePrice,
  ComparisonResult,
  ComparisonPage,
} from "./types.ts";
import { buildButton, createModal } from "./ui.ts";
import {
  getConversionMethodDescription,
  getConversionMethodName,
  currencyFromPageGet,
} from "./utils.ts";

function findBestMatchForMethod(
  table: PricingEntry[],
  page: PagePrice,
  _targetCurrencyCode: number | null,
  method: ConversionMethod,
): ComparisonResult {
  let best: ComparisonResult = {
    entry: null,
    price: null,
    percentFinal: null,
    percentOrig: null,
    currencyCode: null,
  };

  for (const entry of table) {
    // Only use entries for the requested conversion method
    if ((entry.convert_method ?? 3) !== method) {
      continue;
    }

    const prices = entry.currency_prices || [];

    for (const cp of prices) {
      // Modification: Removed restriction to targetCurrencyCode to scan all currencies
      const tablePrice = cp.price;
      if (!tablePrice) continue;

      // Some prices are stored in cents
      const candidates = [tablePrice, tablePrice / 100];

      for (const cand of candidates) {
        if (cand <= 0) continue;

        const percentFinal = ((page.finalPrice - cand) / cand) * 100;
        const percentOrig =
          page.originalPrice !== null
            ? ((page.originalPrice - cand) / cand) * 100
            : null;

        if (
          best.percentFinal == null ||
          Math.abs(percentFinal) < Math.abs(best.percentFinal)
        ) {
          best = {
            entry,
            price: cand,
            percentFinal,
            percentOrig,
            currencyCode: cp.currency_code,
          };
        }
      }
    }

    // Fallback to top-level USD price if available
    if (entry.usd_price) {
      const tablePrice = entry.usd_price;
      const candidates = [tablePrice, tablePrice / 100];

      for (const cand of candidates) {
        if (cand <= 0) continue;

        const percentFinal = ((page.finalPrice - cand) / cand) * 100;
        const percentOrig =
          page.originalPrice !== null
            ? ((page.originalPrice - cand) / cand) * 100
            : null;

        if (
          best.percentFinal == null ||
          Math.abs(percentFinal) < Math.abs(best.percentFinal)
        ) {
          best = {
            entry,
            price: cand,
            percentFinal,
            percentOrig,
            currencyCode: 1, // USD currency code
          };
        }
      }
    }
  }

  return best;
}

function buildComparisonPages(
  table: PricingEntry[],
  page: PagePrice,
  targetCurrencyCode: number | null,
): ComparisonPage[] {
  const methods: ConversionMethod[] = [1, 2, 3];

  return methods.map((method) => ({
    method,
    title: getConversionMethodName(method),
    description: getConversionMethodDescription(method),
    result: findBestMatchForMethod(table, page, targetCurrencyCode, method),
  }));
}

async function fetchPricingTable(
  force = false,
): Promise<PricingEntry[] | null> {
  try {
    const cached = await storageGet<{ ts: number; data: PricingEntry[] }>(
      STORAGE_KEY,
    );
    if (!force && cached && Date.now() - (cached.ts || 0) < TTL) {
      return cached.data;
    }

    const resp = await fetch(PRICING_TABLE);
    if (!resp.ok) return null;
    const data = (await resp.json()) as PricingEntry[];
    await storageSet(STORAGE_KEY, { ts: Date.now(), data });
    return data;
  } catch (e) {
    console.warn("failed to fetch pricing table", e);
    return null;
  }
}

function parsePriceText(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[\s\u00A0]/g, "").replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;
  const withDot = cleaned.replace(/,([0-9]{2})$/, ".$1").replace(/,/g, "");
  const n = parseFloat(withDot);
  return Number.isFinite(n) ? n : null;
}

function findPriceOnPage(): PagePrice | null {
  const pageCurrency = currencyFromPageGet();

  const finalEl =
    document.querySelector(".discount_final_price") ||
    document.querySelector(".game_purchase_price") ||
    document.querySelector(".price");
  const origEl = document.querySelector(".discount_original_price");

  if (finalEl && (finalEl as HTMLElement).offsetParent !== null) {
    const finalTxt = finalEl.textContent || "";
    const finalVal = parsePriceText(finalTxt);

    let origVal: number | null = null;
    let origTxt: string | null = null;

    if (origEl && (origEl as HTMLElement).offsetParent !== null) {
      origTxt = origEl.textContent || "";
      origVal = parsePriceText(origTxt);
    }

    if (finalVal !== null) {
      return {
        finalPrice: finalVal,
        finalRaw: finalTxt.trim(),
        originalPrice: origVal,
        originalRaw: origTxt?.trim() || null,
        symbol: pageCurrency,
      };
    }
  }

  const els = Array.from(
    document.querySelectorAll('[class*=\"price\"]'),
  ) as HTMLElement[];
  for (const el of els) {
    if (el && el.offsetParent !== null) {
      const txt = el.textContent || "";
      const v = parsePriceText(txt);
      if (v !== null) {
        return {
          finalPrice: v,
          finalRaw: txt.trim(),
          originalPrice: null,
          originalRaw: null,
          symbol: pageCurrency,
        };
      }
    }
  }

  return null;
}

function interpretPercent(
  p: number,
  cfg: { positiveTiers: number[]; negativeTiers: number[] },
) {
  if (p >= 0) {
    const idx = cfg.positiveTiers.findIndex((t) => p < t);
    return {
      tier: idx === -1 ? cfg.positiveTiers.length : idx + 1,
      label:
        idx === -1 ? "Huge increase" : `+${cfg.positiveTiers[idx]}% threshold`,
    };
  } else {
    const abs = Math.abs(p);
    const sortedNegatives = [...cfg.negativeTiers]
      .map(Math.abs)
      .sort((a, b) => a - b);
    const idx = sortedNegatives.findIndex((t) => abs < t);
    return {
      tier: idx === -1 ? cfg.negativeTiers.length : idx + 1,
      label: idx === -1 ? "Huge drop" : `-${sortedNegatives[idx]}% threshold`,
    };
  }
}

function getColorForPercent(
  p: number,
  cfg: { positiveTiers: number[]; negativeTiers: number[] },
): string {
  if (p >= 0) {
    const colors = ["#7f8c8d", "#f1c40f", "#f39c12", "#e67e22", "#e74c3c"];
    const idx = cfg.positiveTiers.findIndex((t) => p < t);
    if (idx === -1) return colors[colors.length - 1];
    return colors[idx];
  } else {
    const abs = Math.abs(p);
    const colors = ["#7f8c8d", "#52be80", "#27ae60", "#1e8449", "#117a65"];
    const sortedNegatives = [...cfg.negativeTiers]
      .map(Math.abs)
      .sort((a, b) => a - b);
    const idx = sortedNegatives.findIndex((t) => abs < t);
    if (idx === -1) return colors[colors.length - 1];
    return colors[idx];
  }
}

function renderResult(
  modal: HTMLDivElement,
  pageInfo: PagePrice,
  pages: ComparisonPage[],
  cfg: { positiveTiers: number[]; negativeTiers: number[] },
) {
  modal.innerHTML = "";

  let activePageIndex = pages.findIndex((p) => p.method === 3);
  if (activePageIndex === -1) activePageIndex = 0;

  const renderPage = () => {
    modal.innerHTML = "";

    const page = pages[activePageIndex];

    // Title
    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.marginBottom = "12px";
    title.style.fontSize = "14px";
    title.textContent = "Steam Price Comparison";
    modal.appendChild(title);

    // Tabs
    const tabs = document.createElement("div");
    tabs.style.display = "flex";
    tabs.style.gap = "4px";
    tabs.style.marginBottom = "12px";

    pages.forEach((p, index) => {
      const tab = document.createElement("button");
      tab.textContent = p.title;
      tab.style.flex = "1";
      tab.style.padding = "6px 8px";
      tab.style.fontSize = "11px";
      tab.style.border = "1px solid #ccd0d5";
      tab.style.borderRadius = "4px";
      tab.style.cursor = "pointer";
      tab.style.fontWeight = "600";

      if (index === activePageIndex) {
        tab.style.background = "#1e90ff";
        tab.style.color = "#fff";
        tab.style.borderColor = "#1e90ff";
      } else {
        tab.style.background = "#f5f6f7";
        tab.style.color = "#111";
      }

      tab.addEventListener("click", () => {
        activePageIndex = index;
        renderPage();
      });

      tabs.appendChild(tab);
    });

    modal.appendChild(tabs);

    // Description
    const desc = document.createElement("div");
    desc.style.fontSize = "12px";
    desc.style.color = "#666";
    desc.style.marginBottom = "12px";
    desc.style.fontStyle = "italic";
    desc.textContent = page.description;
    modal.appendChild(desc);

    const bestMatch = page.result;

    if (
      !bestMatch.entry ||
      bestMatch.price == null ||
      bestMatch.percentFinal == null
    ) {
      const noinfo = document.createElement("div");
      noinfo.textContent = "No matching pricing entry found in the table.";
      noinfo.style.marginBottom = "12px";
      modal.appendChild(noinfo);
    } else {
      const tablePriceText = `${bestMatch.price.toFixed(2)} ${
        pageInfo.symbol || ""
      }`;

      const tableRow = document.createElement("div");
      tableRow.style.marginBottom = "12px";
      tableRow.style.padding = "6px 8px";
      tableRow.style.background = "#f8f9fa";
      tableRow.style.borderRadius = "4px";
      tableRow.style.border = "1px solid #e9ecef";
      tableRow.innerHTML = `
        <strong>Base Table Price:</strong>
        <span style="float:right;font-weight:600;">${tablePriceText}</span>
      `;
      modal.appendChild(tableRow);

      // Modification: Displays Selected Currency ID vs Compared Currency ID
      const targetCurrencyCode = pageInfo.symbol
        ? CURRENCY_MAP[pageInfo.symbol]
        : null;
      const currencyInfoRow = document.createElement("div");
      currencyInfoRow.style.marginBottom = "12px";
      currencyInfoRow.style.padding = "6px 8px";
      currencyInfoRow.style.background = "#f0f4f8";
      currencyInfoRow.style.borderRadius = "4px";
      currencyInfoRow.style.border = "1px solid #d0e0f0";
      currencyInfoRow.style.fontSize = "11px";
      currencyInfoRow.innerHTML = `
        <div><strong>Selected Currency ID:</strong> ${targetCurrencyCode ?? "None/Unknown"}</div>
        <div><strong>Compared Currency ID:</strong> ${bestMatch.currencyCode ?? "None/Unknown"}</div>
      `;
      modal.appendChild(currencyInfoRow);

      // Original price
      if (pageInfo.originalPrice !== null && bestMatch.percentOrig !== null) {
        const origColor = getColorForPercent(bestMatch.percentOrig, cfg);

        const origRow = document.createElement("div");
        origRow.style.marginBottom = "8px";
        origRow.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">
            <span><strong>Original:</strong> ${pageInfo.originalRaw}</span>
            <span style="
              color:white;
              font-weight:bold;
              background:${origColor};
              padding:2px 8px;
              border-radius:12px;
              font-size:11px;
              min-width:52px;
              text-align:center;
            ">
              ${bestMatch.percentOrig > 0 ? "+" : ""}${bestMatch.percentOrig.toFixed(1)}%
            </span>
          </div>
        `;
        modal.appendChild(origRow);
      }

      // Final price
      const finalColor = getColorForPercent(bestMatch.percentFinal, cfg);

      const finalRow = document.createElement("div");
      finalRow.style.marginBottom = "12px";
      finalRow.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">
          <span><strong>Current:</strong> ${pageInfo.finalRaw}</span>
          <span style="
            color:white;
            font-weight:bold;
            background:${finalColor};
            padding:2px 8px;
            border-radius:12px;
            font-size:11px;
            min-width:52px;
            text-align:center;
          ">
            ${bestMatch.percentFinal > 0 ? "+" : ""}${bestMatch.percentFinal.toFixed(1)}%
          </span>
        </div>
      `;
      modal.appendChild(finalRow);

      const interp = interpretPercent(bestMatch.percentFinal, cfg);

      const interpRow = document.createElement("div");
      interpRow.style.marginTop = "8px";
      interpRow.style.color = "#666";
      interpRow.style.fontSize = "12px";
      interpRow.style.fontStyle = "italic";
      interpRow.textContent = `Status: ${interp.label} (tier ${interp.tier})`;
      modal.appendChild(interpRow);
    }

    // Settings button
    const settingsLink = document.createElement("button");
    settingsLink.textContent = "⚙️ Configure Thresholds";
    settingsLink.style.display = "block";
    settingsLink.style.marginTop = "14px";
    settingsLink.style.width = "100%";
    settingsLink.style.padding = "8px 10px";
    settingsLink.style.background = "#f5f6f7";
    settingsLink.style.color = "#111";
    settingsLink.style.border = "1px solid #ccd0d5";
    settingsLink.style.borderRadius = "4px";
    settingsLink.style.cursor = "pointer";
    settingsLink.style.fontSize = "12px";
    settingsLink.style.fontWeight = "600";

    settingsLink.addEventListener("click", () => {
      renderSettings(modal, cfg);
    });

    modal.appendChild(settingsLink);
  };

  renderPage();
}

function renderSettings(
  modal: HTMLDivElement,
  cfg: { positiveTiers: number[]; negativeTiers: number[] },
) {
  modal.innerHTML = "";
  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.marginBottom = "12px";
  title.textContent = "Configure percent tiers (4 values each)";
  modal.appendChild(title);

  const posLabel = document.createElement("div");
  posLabel.textContent = "Positive tiers (ascending %):";
  posLabel.style.fontWeight = "600";
  posLabel.style.marginBottom = "4px";
  modal.appendChild(posLabel);

  const posInput = document.createElement("input");
  posInput.value = cfg.positiveTiers.join(",");
  posInput.style.width = "100%";
  posInput.style.padding = "6px";
  posInput.style.boxSizing = "border-box";
  posInput.style.border = "1px solid #ccc";
  posInput.style.borderRadius = "4px";
  posInput.style.marginBottom = "12px";
  modal.appendChild(posInput);

  const negLabel = document.createElement("div");
  negLabel.textContent = "Negative tiers (ascending absolute %):";
  negLabel.style.fontWeight = "600";
  negLabel.style.marginBottom = "4px";
  modal.appendChild(negLabel);

  const negInput = document.createElement("input");
  negInput.value = cfg.negativeTiers.join(",");
  negInput.style.width = "100%";
  negInput.style.padding = "6px";
  negInput.style.boxSizing = "border-box";
  negInput.style.border = "1px solid #ccc";
  negInput.style.borderRadius = "4px";
  negInput.style.marginBottom = "14px";
  modal.appendChild(negInput);

  const btnContainer = document.createElement("div");
  btnContainer.style.display = "flex";
  btnContainer.style.gap = "8px";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save Settings";
  saveBtn.style.flex = "1";
  saveBtn.style.padding = "8px";
  saveBtn.style.background = "#1e90ff";
  saveBtn.style.color = "white";
  saveBtn.style.border = "none";
  saveBtn.style.borderRadius = "4px";
  saveBtn.style.cursor = "pointer";
  saveBtn.style.fontWeight = "600";

  saveBtn.addEventListener("click", async () => {
    const p = posInput.value
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));
    const n = negInput.value
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));
    await storageSet(STORAGE_KEY_CONFIG, {
      positiveTiers: p,
      negativeTiers: n,
    });

    modal.innerHTML =
      '<div style="text-align:center; padding: 20px; font-weight:600; color: #2ecc71;">Settings Saved!</div>';
    setTimeout(() => {
      modal.style.display = "none";
    }, 1200);
  });

  btnContainer.appendChild(saveBtn);
  modal.appendChild(btnContainer);
}

async function run() {
  const existingBtn = document.getElementById("steam-pricing-compare-btn");
  const existingModal = document.getElementById("steam-pricing-modal");

  if (existingBtn) existingBtn.remove();
  if (existingModal) existingModal.remove();

  const btn = buildButton();
  const modal = createModal();

  document.body.appendChild(btn);
  document.body.appendChild(modal);

  btn.addEventListener("click", async () => {
    modal.style.display = modal.style.display === "none" ? "block" : "none";

    if (modal.style.display === "none") {
      return;
    }

    modal.innerHTML = "Loading...";

    const page = findPriceOnPage();
    if (!page) {
      modal.innerHTML = "Unable to detect price on this page.";
      return;
    }

    const table = await fetchPricingTable(false);
    if (!table) {
      modal.innerHTML = "Unable to load pricing table.";
      return;
    }

    const cfg = await getConfig();

    const targetCurrencyCode = page.symbol ? CURRENCY_MAP[page.symbol] : null;

    const pages = buildComparisonPages(table, page, targetCurrencyCode);

    renderResult(modal, page, pages, cfg);
  });

  void fetchPricingTable(false);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}
