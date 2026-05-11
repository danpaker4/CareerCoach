import { ENV } from "../config";
import type { User } from "../types/user";
import { isUser } from "./authResponse";
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from "./authSession";

const REFRESH_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/refresh`;
const inFlightGetRequests = new Map<string, Promise<Response>>();

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

const isRefreshPayload = (payload: unknown): payload is { accessToken: string; user: User } =>
  typeof payload === "object" &&
  payload !== null &&
  "accessToken" in payload &&
  typeof payload.accessToken === "string" &&
  "user" in payload &&
  isUser(payload.user);

const redirectToLogin = (): void => {
  clearStoredAccessToken();
  if (isAuthPageRoute()) {
    return;
  }
  window.location.assign("/login");
};

const buildRequestHeaders = (init: RequestInit): Headers => {
  const headers = new Headers(init.headers);
  const accessToken = getStoredAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return headers;
};

const serializeHeaders = (headers: Headers): string =>
  Array.from(headers.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");

const getInFlightGetRequestKey = (input: string, init: RequestInit, headers: Headers): string | null => {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" || init.body) {
    return null;
  }

  return JSON.stringify({
    input,
    method,
    credentials: init.credentials ?? "include",
    headers: serializeHeaders(headers),
  });
};

const performApiFetch = async (input: string, init: RequestInit = {}, didRetry = false): Promise<Response> => {
  const headers = buildRequestHeaders(init);
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

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    redirectToLogin();
    return response;
  }

  return performApiFetch(input, init, true);
};

export const refreshAccessToken = async (): Promise<User | null> => {
  const response = await fetch(REFRESH_PATH, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const payload: unknown = await response.json().catch(() => null);
  if (isRefreshPayload(payload)) {
    setStoredAccessToken(payload.accessToken);
    return payload.user;
  }

  return null;
};

export const apiFetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
  const headers = buildRequestHeaders(init);
  const requestKey = getInFlightGetRequestKey(input, init, headers);

  if (!requestKey) {
    return performApiFetch(input, init);
  }

  const inFlightRequest = inFlightGetRequests.get(requestKey);
  if (inFlightRequest) {
    const response = await inFlightRequest;
    return response.clone();
  }

  // React StrictMode re-runs mount effects in development, which can otherwise duplicate page-level GETs.
  const requestPromise = performApiFetch(input, init).finally(() => {
    inFlightGetRequests.delete(requestKey);
  });

  inFlightGetRequests.set(requestKey, requestPromise);
  const response = await requestPromise;
  return response.clone();
};
