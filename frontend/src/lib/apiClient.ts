import { ENV } from "../config";

const REFRESH_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/refresh`;

const isRefreshRequest = (url: string): boolean => url.includes("/api/auth/refresh");
const isAuthBootstrapRequest = (url: string): boolean =>
  url.includes("/api/auth/login") || url.includes("/api/auth/register");

const shouldTryRefresh = (status: number, payload: any): boolean => {
  if (status !== 401) {
    return false;
  }
  const code = payload?.errorCode;
  return code === "ACCESS_TOKEN_EXPIRED" || code === "ACCESS_TOKEN_MISSING";
};

const redirectToLogin = (): void => {
  window.location.assign("/login");
};

export const apiFetch = async (input: string, init: RequestInit = {}, didRetry = false): Promise<Response> => {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (isRefreshRequest(input) || isAuthBootstrapRequest(input)) {
    return response;
  }

  const cloned = response.clone();
  const payload = await cloned.json().catch(() => null);
  if (!shouldTryRefresh(response.status, payload) || didRetry) {
    return response;
  }

  const refreshResponse = await fetch(REFRESH_PATH, {
    method: "POST",
    credentials: "include",
  });

  if (!refreshResponse.ok) {
    redirectToLogin();
    return response;
  }

  return apiFetch(input, init, true);
};
