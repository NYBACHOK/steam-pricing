const PRICING_TABLE = 'https://raw.githubusercontent.com/NYBACHOK/steam-pricing/master/pricing_table.json'

type PricingEntry = {
  usd_price?: number;
  currency_prices?: Array<{ currency_code: number; price: number }>;
  region_prices?: Array<any>;
  convert_method?: number;
};

interface PagePrice {
  finalPrice: number;
  finalRaw: string;
  originalPrice: number | null;
  originalRaw: string | null;
  symbol: string | null;
}

const STORAGE_KEY = 'steam_pricing_cache_v1';
const STORAGE_KEY_CONFIG = 'steam_pricing_config_v1';
const TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

const CURRENCY_MAP: Record<string, number> = {
  '$': 1,      // USD
  '£': 2,      // GBP
  '€': 3,      // EUR
  'CHF': 4,    // CHF
  'pуб.': 5,   // RUB
  '₽': 5,      // RUB
  'zł': 6,     // PLN
  'R$': 7,     // BRL
  '¥': 8,      // JPY / CNY
  'Rp': 10,    // IDR
  'RM': 11,    // MYR
  '₱': 12,     // PHP
  'S$': 13,    // SGD
  '฿': 14,     // THB
  '₫': 15,     // VND
  '₩': 16,     // KRW
  '₺': 17,     // TRY
  '₴': 18,     // UAH
  'Mex$': 19,  // MXN
  'CDN$': 20,  // CAD
  'A$': 21,    // AUD
  'NZ$': 22,   // NZD
  '₹': 24,     // INR
  'CLP$': 25,  // CLP
  'S/.': 26,   // PEN
  'COL$': 27,  // COP
  'R': 28,     // ZAR
  'HK$': 29,   // HKD
  'NT$': 30,   // TWD
  'SR': 31,    // SAR
  'AED': 32,   // AED
  'ARS$': 34,  // ARS
  '₪': 35,     // ILS
  '₸': 37,     // KZT
  'KD': 38,    // KWD
  'QR': 39,    // QAR
  '₡': 40,     // CRC
  '$U': 41,    // UYU
};

function storageGet<T = any>(key: string): Promise<T | undefined> {
  return new Promise((res) => {
    chrome.storage.local.get([key], (out) => {
      res(out[key] as T | undefined);
    });
  });
}

function storageSet(key: string, value: any): Promise<void> {
  return new Promise((res) => {
    chrome.storage.local.set({ [key]: value }, () => res());
  });
}

async function fetchPricingTable(force = false): Promise<PricingEntry[] | null> {
  try {
    const cached = await storageGet<{ ts: number; data: PricingEntry[] }>(STORAGE_KEY);
    if (!force && cached && Date.now() - (cached.ts || 0) < TTL) {
      return cached.data;
    }

    const resp = await fetch(PRICING_TABLE);
    if (!resp.ok) return null;
    const data = (await resp.json()) as PricingEntry[];
    await storageSet(STORAGE_KEY, { ts: Date.now(), data });
    return data;
  } catch (e) {
    console.warn('failed to fetch pricing table', e);
    return null;
  }
}

function parsePriceText(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[\s\u00A0]/g, '').replace(/[^0-9.,-]/g, '');
  if (!cleaned) return null;
  const withDot = cleaned.replace(/,([0-9]{2})$/, '.$1').replace(/,/g, '');
  const n = parseFloat(withDot);
  return Number.isFinite(n) ? n : null;
}

function extractCurrencySymbol(text: string): string | null {
  const symbol = text.replace(/[0-9.,\s\u00A0-]/g, '').trim();
  return symbol || null;
}

function findPriceOnPage(): PagePrice | null {
  const finalEl = document.querySelector('.discount_final_price') || document.querySelector('.game_purchase_price') || document.querySelector('.price');
  const origEl = document.querySelector('.discount_original_price');

  if (finalEl && (finalEl as HTMLElement).offsetParent !== null) {
    const finalTxt = finalEl.textContent || '';
    const finalVal = parsePriceText(finalTxt);
    const symbol = extractCurrencySymbol(finalTxt);

    let origVal: number | null = null;
    let origTxt: string | null = null;

    if (origEl && (origEl as HTMLElement).offsetParent !== null) {
      origTxt = origEl.textContent || '';
      origVal = parsePriceText(origTxt);
    }

    if (finalVal !== null) {
      return { 
        finalPrice: finalVal, 
        finalRaw: finalTxt.trim(), 
        originalPrice: origVal, 
        originalRaw: origTxt?.trim() || null,
        symbol 
      };
    }
  }

  const els = Array.from(document.querySelectorAll('[class*=\"price\"]')) as HTMLElement[];
  for (const el of els) {
    if (el && el.offsetParent !== null) {
      const txt = el.textContent || '';
      const v = parsePriceText(txt);
      if (v !== null) {
        return { 
          finalPrice: v, 
          finalRaw: txt.trim(), 
          originalPrice: null, 
          originalRaw: null, 
          symbol: extractCurrencySymbol(txt) 
        };
      }
    }
  }

  return null;
}

function buildButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = 'steam-pricing-compare-btn';
  btn.textContent = 'Compare price';
  btn.style.position = 'fixed';
  btn.style.right = '12px';
  btn.style.bottom = '12px';
  btn.style.zIndex = '999999';
  btn.style.padding = '8px 10px';
  btn.style.borderRadius = '6px';
  btn.style.background = '#1e90ff';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  return btn;
}

function createModal(): HTMLDivElement {
  const modal = document.createElement('div');
  modal.id = 'steam-pricing-modal';
  modal.style.position = 'fixed';
  modal.style.right = '12px';
  modal.style.bottom = '60px';
  modal.style.zIndex = '999999';
  modal.style.minWidth = '300px';
  modal.style.maxWidth = '420px';
  modal.style.background = '#fff';
  modal.style.color = '#111';
  modal.style.border = '1px solid rgba(0,0,0,0.12)';
  modal.style.borderRadius = '6px';
  modal.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
  modal.style.padding = '14px';
  modal.style.fontSize = '13px';
  modal.style.display = 'none';
  modal.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  return modal;
}

async function getConfig() {
  const defaults = {
    positiveTiers: [5, 15, 30, 60],
    negativeTiers: [-5, -15, -30, -60],
  };
  const cfg = (await storageGet(STORAGE_KEY_CONFIG)) || defaults;
  return { ...defaults, ...cfg };
}

function interpretPercent(p: number, cfg: { positiveTiers: number[]; negativeTiers: number[] }) {
  if (p >= 0) {
    const idx = cfg.positiveTiers.findIndex((t) => p < t);
    return {
      tier: idx === -1 ? cfg.positiveTiers.length : idx + 1,
      label: idx === -1 ? 'Huge increase' : `+${cfg.positiveTiers[idx]}% threshold`,
    };
  } else {
    const abs = Math.abs(p);
    const sortedNegatives = [...cfg.negativeTiers].map(Math.abs).sort((a, b) => a - b);
    const idx = sortedNegatives.findIndex((t) => abs < t);
    return {
      tier: idx === -1 ? cfg.negativeTiers.length : idx + 1,
      label: idx === -1 ? 'Huge drop' : `-${sortedNegatives[idx]}% threshold`,
    };
  }
}

// 3. Dynamic color mapping completely built off threshold configuration variables
function getColorForPercent(p: number, cfg: { positiveTiers: number[]; negativeTiers: number[] }): string {
  if (p >= 0) {
    const colors = ['#7f8c8d', '#f1c40f', '#f39c12', '#e67e22', '#e74c3c']; // Neutral, Soft warnings, Heavy warning
    const idx = cfg.positiveTiers.findIndex((t) => p < t);
    if (idx === -1) return colors[colors.length - 1];
    return colors[idx];
  } else {
    const abs = Math.abs(p);
    const colors = ['#7f8c8d', '#52be80', '#27ae60', '#1e8449', '#117a65']; // Neutral, Incremental green improvements
    const sortedNegatives = [...cfg.negativeTiers].map(Math.abs).sort((a, b) => a - b);
    const idx = sortedNegatives.findIndex((t) => abs < t);
    if (idx === -1) return colors[colors.length - 1];
    return colors[idx];
  }
}

function renderResult(
  modal: HTMLDivElement, 
  pageInfo: PagePrice, 
  bestMatch: { entry: PricingEntry | null; price: number | null; percentFinal: number | null; percentOrig: number | null },
  cfg: { positiveTiers: number[]; negativeTiers: number[] }
) {
  modal.innerHTML = '';
  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.marginBottom = '12px';
  title.style.fontSize = '14px';
  title.textContent = 'Steam Price Comparison';
  modal.appendChild(title);

  if (!bestMatch.entry || bestMatch.price == null || bestMatch.percentFinal == null) {
    const noinfo = document.createElement('div');
    noinfo.style.marginTop = '8px';
    noinfo.textContent = 'No matching pricing entry found in the table.';
    modal.appendChild(noinfo);
    return;
  }

  const tablePriceText = `${bestMatch.price.toFixed(2)} ${pageInfo.symbol || ''}`;
  const tableRow = document.createElement('div');
  tableRow.style.marginBottom = '12px';
  tableRow.style.padding = '6px 8px';
  tableRow.style.background = '#f8f9fa';
  tableRow.style.borderRadius = '4px';
  tableRow.style.border = '1px solid #e9ecef';
  tableRow.innerHTML = `<strong>Base Table Price:</strong> <span style="float: right; font-weight: 600;">${tablePriceText}</span>`;
  modal.appendChild(tableRow);

  // Compare Original (Non-discount) Price 
  if (pageInfo.originalPrice !== null && bestMatch.percentOrig !== null) {
    const origRow = document.createElement('div');
    const origColor = getColorForPercent(bestMatch.percentOrig, cfg);
    origRow.style.marginBottom = '8px';
    origRow.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
          <span><strong>Original (Non-discount):</strong> ${pageInfo.originalRaw}</span>
          <span style="color: white; font-weight: bold; background: ${origColor}; padding: 2px 8px; border-radius: 12px; font-size: 11px; min-width: 52px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
              ${bestMatch.percentOrig > 0 ? '+' : ''}${bestMatch.percentOrig.toFixed(1)}%
          </span>
      </div>
    `;
    modal.appendChild(origRow);
  }

  // Compare Current (Discounted / Final) Price
  const finalRow = document.createElement('div');
  const finalColor = getColorForPercent(bestMatch.percentFinal, cfg);
  finalRow.style.marginBottom = '12px';
  finalRow.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
        <span><strong>Current / Final Price:</strong> ${pageInfo.finalRaw}</span>
        <span style="color: white; font-weight: bold; background: ${finalColor}; padding: 2px 8px; border-radius: 12px; font-size: 11px; min-width: 52px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
            ${bestMatch.percentFinal > 0 ? '+' : ''}${bestMatch.percentFinal.toFixed(1)}%
        </span>
    </div>
  `;
  modal.appendChild(finalRow);

  const interp = interpretPercent(bestMatch.percentFinal, cfg);
  const interpRow = document.createElement('div');
  interpRow.style.marginTop = '8px';
  interpRow.style.color = '#666';
  interpRow.style.fontSize = '12px';
  interpRow.style.fontStyle = 'italic';
  interpRow.textContent = `Status: ${interp.label} (tier ${interp.tier})`;
  modal.appendChild(interpRow);

  // 1. Redesigned "Configure Thresholds" button to look fully solid, dark-bordered and highly visible on white surfaces
  const settingsLink = document.createElement('button');
  settingsLink.textContent = '⚙️ Configure Thresholds';
  settingsLink.style.display = 'block';
  settingsLink.style.marginTop = '14px';
  settingsLink.style.width = '100%';
  settingsLink.style.padding = '8px 10px';
  settingsLink.style.background = '#f5f6f7';
  settingsLink.style.color = '#111';
  settingsLink.style.border = '1px solid #ccd0d5';
  settingsLink.style.borderRadius = '4px';
  settingsLink.style.cursor = 'pointer';
  settingsLink.style.fontSize = '12px';
  settingsLink.style.fontWeight = '600';
  settingsLink.style.textAlign = 'center';
  settingsLink.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
  
  settingsLink.addEventListener('mouseover', () => settingsLink.style.background = '#ebedf0');
  settingsLink.addEventListener('mouseout', () => settingsLink.style.background = '#f5f6f7');
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    renderSettings(modal, cfg);
  });
  modal.appendChild(settingsLink);
}

function renderSettings(modal: HTMLDivElement, cfg: { positiveTiers: number[]; negativeTiers: number[] }) {
  modal.innerHTML = '';
  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.marginBottom = '12px';
  title.textContent = 'Configure percent tiers (4 values each)';
  modal.appendChild(title);

  const posLabel = document.createElement('div');
  posLabel.textContent = 'Positive tiers (ascending %):';
  posLabel.style.fontWeight = '600';
  posLabel.style.marginBottom = '4px';
  modal.appendChild(posLabel);
  
  const posInput = document.createElement('input');
  posInput.value = cfg.positiveTiers.join(',');
  posInput.style.width = '100%';
  posInput.style.padding = '6px';
  posInput.style.boxSizing = 'border-box';
  posInput.style.border = '1px solid #ccc';
  posInput.style.borderRadius = '4px';
  posInput.style.marginBottom = '12px';
  modal.appendChild(posInput);

  const negLabel = document.createElement('div');
  negLabel.textContent = 'Negative tiers (ascending absolute %):';
  negLabel.style.fontWeight = '600';
  negLabel.style.marginBottom = '4px';
  modal.appendChild(negLabel);
  
  const negInput = document.createElement('input');
  negInput.value = cfg.negativeTiers.join(',');
  negInput.style.width = '100%';
  negInput.style.padding = '6px';
  negInput.style.boxSizing = 'border-box';
  negInput.style.border = '1px solid #ccc';
  negInput.style.borderRadius = '4px';
  negInput.style.marginBottom = '14px';
  modal.appendChild(negInput);

  const btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '8px';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Settings';
  saveBtn.style.flex = '1';
  saveBtn.style.padding = '8px';
  saveBtn.style.background = '#1e90ff';
  saveBtn.style.color = 'white';
  saveBtn.style.border = 'none';
  saveBtn.style.borderRadius = '4px';
  saveBtn.style.cursor = 'pointer';
  saveBtn.style.fontWeight = '600';
  
  saveBtn.addEventListener('click', async () => {
    const p = posInput.value.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    const n = negInput.value.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    await storageSet(STORAGE_KEY_CONFIG, { positiveTiers: p, negativeTiers: n });
    
    modal.innerHTML = '<div style=\"text-align:center; padding: 20px; font-weight:600; color: #2ecc71;\">Settings Saved!</div>';
    setTimeout(() => {
      modal.style.display = 'none';
    }, 1200);
  });
  
  btnContainer.appendChild(saveBtn);
  modal.appendChild(btnContainer);
}

async function run() {
  const btn = buildButton();
  const modal = createModal();
  document.body.appendChild(btn);
  document.body.appendChild(modal);

  btn.addEventListener('click', async () => {
    modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
    if (modal.style.display === 'none') return;

    const page = findPriceOnPage();
    if (!page) {
      modal.innerHTML = 'Unable to detect price on this page.';
      return;
    }

    const table = await fetchPricingTable(false);
    if (!table) {
      modal.innerHTML = 'Unable to load pricing table.';
      return;
    }

    const cfg = await getConfig();
    const targetCurrencyCode = page.symbol ? CURRENCY_MAP[page.symbol] : null;

    let best: { entry: PricingEntry | null; price: number | null; percentFinal: number | null; percentOrig: number | null } = { 
      entry: null, 
      price: null, 
      percentFinal: null,
      percentOrig: null
    };

    for (const entry of table) {
      const prices = entry.currency_prices || [];
      
      for (const cp of prices) {
        if (targetCurrencyCode && cp.currency_code !== targetCurrencyCode) {
          continue; 
        }

        const tablePrice = cp.price as number;
        if (!tablePrice) continue;
        
        const candidates = [tablePrice, tablePrice / 100];
        for (const cand of candidates) {
          if (cand <= 0) continue;
          
          const percentFinal = ((page.finalPrice - cand) / cand) * 100;
          const percentOrig = page.originalPrice !== null ? ((page.originalPrice - cand) / cand) * 100 : null;

          if (best.percentFinal == null || Math.abs(percentFinal) < Math.abs(best.percentFinal)) {
            best = { entry, price: cand, percentFinal, percentOrig };
          }
        }
      }

      if ((!targetCurrencyCode || targetCurrencyCode === 1) && entry.usd_price) {
        const tablePrice = entry.usd_price;
        const candidates = [tablePrice, tablePrice / 100];
        for (const cand of candidates) {
          if (cand <= 0) continue;
          const percentFinal = ((page.finalPrice - cand) / cand) * 100;
          const percentOrig = page.originalPrice !== null ? ((page.originalPrice - cand) / cand) * 100 : null;
          if (best.percentFinal == null || Math.abs(percentFinal) < Math.abs(best.percentFinal)) {
            best = { entry, price: cand, percentFinal, percentOrig };
          }
        }
      }
    }

    renderResult(modal, page, best, cfg);
  });

  fetchPricingTable(false);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run);
} else {
  run();
}