const tokenStore: { current: string | null } = { current: null };

export const getStoredAccessToken = (): string | null => tokenStore.current;

export const setStoredAccessToken = (token: string): void => {
  tokenStore.current = token;
};

export const clearStoredAccessToken = (): void => {
  tokenStore.current = null;
};
