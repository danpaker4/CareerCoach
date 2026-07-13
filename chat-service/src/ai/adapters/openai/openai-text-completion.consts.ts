// OPENAI_BASE_URL lets an OpenAI-compatible gateway (e.g. the college LLM's /v1 API) replace api.openai.com.
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
export const OPENAI_CHAT_COMPLETIONS_URL = `${OPENAI_BASE_URL}/v1/chat/completions`;
