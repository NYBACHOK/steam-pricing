export function buildButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = "steam-pricing-compare-btn";
  btn.textContent = "Compare price";
  btn.style.position = "fixed";
  btn.style.right = "12px";
  btn.style.bottom = "12px";
  btn.style.zIndex = "999999";
  btn.style.padding = "8px 10px";
  btn.style.borderRadius = "6px";
  btn.style.background = "#1e90ff";
  btn.style.color = "white";
  btn.style.border = "none";
  btn.style.cursor = "pointer";
  btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  return btn;
}

export function createModal(): HTMLDivElement {
  const modal = document.createElement("div");
  modal.id = "steam-pricing-modal";
  modal.style.position = "fixed";
  modal.style.right = "12px";
  modal.style.bottom = "60px";
  modal.style.zIndex = "999999";
  modal.style.minWidth = "300px";
  modal.style.maxWidth = "420px";
  modal.style.background = "#fff";
  modal.style.color = "#111";
  modal.style.border = "1px solid rgba(0,0,0,0.12)";
  modal.style.borderRadius = "6px";
  modal.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)";
  modal.style.padding = "14px";
  modal.style.fontSize = "13px";
  modal.style.display = "none";
  modal.style.fontFamily = "system-ui, -apple-system, sans-serif";
  return modal;
}
