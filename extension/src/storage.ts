import { STORAGE_KEY_CONFIG } from "./consts";

export function storageGet<T = any>(key: string): Promise<T | undefined> {
  return new Promise((res) => {
    chrome.storage.local.get([key], (out) => {
      res(out[key] as T | undefined);
    });
  });
}

export function storageSet(key: string, value: any): Promise<void> {
  return new Promise((res) => {
    chrome.storage.local.set({ [key]: value }, () => res());
  });
}

export async function getConfig() {
  const defaults = {
    positiveTiers: [5, 15, 30, 60],
    negativeTiers: [-5, -15, -30, -60],
  };
  const cfg = (await storageGet(STORAGE_KEY_CONFIG)) || defaults;
  return { ...defaults, ...cfg };
}
