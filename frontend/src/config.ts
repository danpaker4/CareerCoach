const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

const normalizeLocalServiceUrl = (rawUrl: string | undefined): string => {
  if (!rawUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const appHost = window.location.hostname;
    const shouldNormalizeHost =
      LOOPBACK_HOSTS.has(parsedUrl.hostname) &&
      LOOPBACK_HOSTS.has(appHost) &&
      parsedUrl.hostname !== appHost;

    if (shouldNormalizeHost) {
      parsedUrl.hostname = appHost;
    }

    return parsedUrl.toString().replace(/\/$/, "");
  } catch {
    return rawUrl;
  }
};

export const ENV = {
  GITHUB_CLIENT_ID: import.meta.env.VITE_CLIENT_ID,
  USERS_SERVICE_BASE_URL: normalizeLocalServiceUrl(import.meta.env.VITE_USERS_SERVICE_BASE_URL) || "",
  CHAT_SERVICE_BASE_URL: normalizeLocalServiceUrl(import.meta.env.VITE_CHAT_SERVICE_BASE_URL) || "",
  JOB_SERVICE_BASE_URL: normalizeLocalServiceUrl(import.meta.env.VITE_JOB_SERVICE_BASE_URL) || "",
};
