export const ENV = {
  GITHUB_CLIENT_ID: import.meta.env.VITE_CLIENT_ID,
  USERS_SERVICE_BASE_URL: import.meta.env.VITE_USERS_SERVICE_BASE_URL || "",
  CHAT_SERVICE_BASE_URL: import.meta.env.VITE_CHAT_SERVICE_BASE_URL || "",
  JOB_SERVICE_BASE_URL: import.meta.env.VITE_JOB_SERVICE_BASE_URL || "",
};
