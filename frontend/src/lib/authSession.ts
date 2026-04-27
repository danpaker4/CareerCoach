const ACCESS_TOKEN_STORAGE_KEY = "careerCoach.accessToken";

export const getStoredAccessToken = (): string | null => window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

export const setStoredAccessToken = (accessToken: string): void => {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
};

export const clearStoredAccessToken = (): void => {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
};
