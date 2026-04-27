import { ENV } from "../config";
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from "./authSession";

const REFRESH_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/refresh`;

const isRefreshRequest = (url: string): boolean => url.includes("/api/auth/refresh");
const isAuthBootstrapRequest = (url: string): boolean =>
  url.includes("/api/auth/login") || url.includes("/api/auth/register");
const isAuthPageRoute = (): boolean =>
  window.location.pathname === "/login" || window.location.pathname === "/signup";

const isErrorPayload = (payload: unknown): payload is { errorCode?: string } =>
  typeof payload === "object" && payload !== null && "errorCode" in payload;

const shouldTryRefresh = (status: number, payload: unknown): boolean => {
  if (status !== 401) {
    return false;
  }
  const code = isErrorPayload(payload) ? payload.errorCode : undefined;
  return code === "ACCESS_TOKEN_EXPIRED" || code === "ACCESS_TOKEN_MISSING";
};

const redirectToLogin = (): void => {
  clearStoredAccessToken();
  if (isAuthPageRoute()) {
    return;
  }
  window.location.assign("/login");
};

export const apiFetch = async (input: string, init: RequestInit = {}, didRetry = false): Promise<Response> => {
  const headers = new Headers(init.headers);
  const accessToken = getStoredAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
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
    method: "GET",
    credentials: "include",
  });

  if (!refreshResponse.ok) {
    redirectToLogin();
    return response;
  }

  const refreshPayload: unknown = await refreshResponse.json().catch(() => null);
  if (
    typeof refreshPayload === "object" &&
    refreshPayload !== null &&
    "accessToken" in refreshPayload &&
    typeof refreshPayload.accessToken === "string"
  ) {
    setStoredAccessToken(refreshPayload.accessToken);
  }

  return apiFetch(input, init, true);
};
