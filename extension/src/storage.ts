import Browser from "webextension-polyfill";
import { STORAGE_KEY_CONFIG } from "./consts.ts";

export function storageGet<T = any>(key: string): Promise<T | undefined> {
  return Browser.storage.local.get([key]).then((out: Record<string, any>) => {
    return out[key] as T | undefined;
  });
}

export function storageSet(key: string, value: any): Promise<void> {
  return Browser.storage.local.set({ [key]: value });
}

export async function getConfig() {
  const defaults = {
    positiveTiers: [5, 15, 30, 60],
    negativeTiers: [-5, -15, -30, -60],
  };
  const cfg = (await storageGet(STORAGE_KEY_CONFIG)) || defaults;
  return { ...defaults, ...cfg };
}
