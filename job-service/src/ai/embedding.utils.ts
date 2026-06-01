import { GoogleGenerativeAI } from "@google/generative-ai";

const VECTOR_MODEL = process.env.JOB_EMBEDDING_MODEL || "text-embedding-004";
const FALLBACK_MODELS = ["gemini-embedding-001", "embedding-001"] as const;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 400;

type EmbeddingError = { status?: number };

let genAIInstance: GoogleGenerativeAI | null = null;

const getClient = (): GoogleGenerativeAI | null => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(apiKey);
    }
    return genAIInstance;
};

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate an embedding vector for the given text using Gemini.
 * Tries primary model first, then falls back to alternatives.
 * Returns null when no API key is configured or all models fail.
 */
export const generateQueryVector = async (
    queryText: string
): Promise<number[] | null> => {
    const client = getClient();
    if (!client) return null;

    const models = [VECTOR_MODEL, ...FALLBACK_MODELS];

    for (const modelName of models) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
            try {
                const model = client.getGenerativeModel({ model: modelName });
                const result = await model.embedContent(queryText);
                const values = result.embedding?.values;
                return Array.isArray(values) && values.length > 0
                    ? values
                    : null;
            } catch (error) {
                const status = (error as EmbeddingError).status;
                if (status === 404) break;
                if (status !== 429 || attempt === MAX_RETRIES) throw error;
                await sleep(RETRY_BASE_DELAY_MS * attempt);
            }
        }
    }

    return null;
};
