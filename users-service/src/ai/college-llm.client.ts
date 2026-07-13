// Minimal client for an Ollama-compatible LLM gateway (e.g. the college service
// at llm.cs.colman.ac.il, which sits behind nginx HTTP Basic Auth).
// Enabled via env: OLLAMA_BASE_URL (+ optional LLM_BASIC_AUTH="user:password").

const DEFAULT_OLLAMA_MODEL = "llama3";
const DEFAULT_EMBEDDING_MODEL = "all-minilm:latest";
const REQUEST_TIMEOUT_MS = 120_000;

const buildLlmAuthHeaders = (): Record<string, string> => {
    const basic = process.env.LLM_BASIC_AUTH?.trim();
    return basic ? { Authorization: `Basic ${Buffer.from(basic).toString("base64")}` } : {};
};

const resolveBaseUrl = (): string =>
    (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

export const isOllamaTextProvider = (): boolean =>
    (process.env.LLM_PROVIDER || "").trim().toLowerCase() === "ollama";

export const isOllamaEmbeddingProvider = (): boolean =>
    (process.env.EMBEDDING_PROVIDER || "").trim().toLowerCase() === "ollama";

export const generateText = async (prompt: string): Promise<string> => {
    const model = process.env.OLLAMA_MODEL || process.env.LLM_MODEL || DEFAULT_OLLAMA_MODEL;
    const response = await fetch(`${resolveBaseUrl()}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildLlmAuthHeaders() },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({ model, prompt, stream: false }),
    });
    const payload: unknown = await response.json().catch(() => null);
    const text = typeof payload === "object" && payload !== null && "response" in payload
        ? (payload as { response?: unknown }).response
        : undefined;
    if (!response.ok || typeof text !== "string" || text.trim().length === 0) {
        throw new Error(`Ollama completion failed with status ${response.status}`);
    }
    return text.trim();
};

export const embedText = async (text: string): Promise<number[]> => {
    const model = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
    const response = await fetch(`${resolveBaseUrl()}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildLlmAuthHeaders() },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({ model, input: text }),
    });
    const payload: unknown = await response.json().catch(() => null);
    const rows = typeof payload === "object" && payload !== null && "embeddings" in payload
        ? (payload as { embeddings?: unknown }).embeddings
        : undefined;
    const vector = Array.isArray(rows) ? rows[0] : undefined;
    if (!response.ok || !Array.isArray(vector) || vector.length === 0) {
        throw new Error(`Ollama embedding failed with status ${response.status}`);
    }
    return vector.filter((item): item is number => typeof item === "number");
};
