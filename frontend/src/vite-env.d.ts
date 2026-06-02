/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_ID: string;
  readonly VITE_USERS_SERVICE_BASE_URL?: string;
  readonly VITE_CHAT_SERVICE_BASE_URL?: string;
  readonly VITE_JOB_SERVICE_BASE_URL?: string;
  readonly VITE_EVALUATION_SERVICE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
