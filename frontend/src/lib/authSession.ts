const ACCESS_TOKEN_STORAGE_KEY = 'cc_access_token';

const readInitialToken = (): string | null => {
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

// Backed by sessionStorage so a page reload does not drop the session while the
// access token is still valid (the refresh-cookie path can fail cross-origin in dev).
const tokenStore: { current: string | null } = { current: readInitialToken() };

export const getStoredAccessToken = (): string | null => tokenStore.current;

export const setStoredAccessToken = (token: string): void => {
  tokenStore.current = token;
  try {
    window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } catch {
    /* sessionStorage unavailable — in-memory value still works for this tab */
  }
};

export const clearStoredAccessToken = (): void => {
  tokenStore.current = null;
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
