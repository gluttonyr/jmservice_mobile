// Web: expo-secure-store has no browser implementation of these calls, so values live in localStorage
// (same API as the three functions the app uses). shortcut: not encrypted, acceptable for a session token in a browser.
// Some browsers (in-app browsers, private mode, blocked site data) throw on localStorage: the site then
// opens without a saved session instead of staying stuck on the splash.
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    storage()?.setItem(key, value);
  } catch {}
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    storage()?.removeItem(key);
  } catch {}
}
