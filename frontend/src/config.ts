export const ENV = {
  GITHUB_CLIENT_ID: import.meta.env.VITE_CLIENT_ID,
  USERS_SERVICE_BASE_URL: import.meta.env.VITE_USERS_SERVICE_BASE_URL || "http://127.0.0.1:3001",
  CHAT_SERVICE_BASE_URL: import.meta.env.VITE_CHAT_SERVICE_BASE_URL || "http://127.0.0.1:3002",
  JOB_SERVICE_BASE_URL: import.meta.env.VITE_JOB_SERVICE_BASE_URL || "http://127.0.0.1:3003",
};
