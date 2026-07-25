import { GoogleGenerativeAI } from "@google/generative-ai";
import { getJobEmbeddingConfig } from "./job-embedding.config";
import { withSpan } from "../observability/tracing";
import { runEmbeddingRequestWithRetry } from "./embedding-retry.utils";

const embeddingClientState: { client: GoogleGenerativeAI | null } = {
    client: null,
};

const getClient = (): GoogleGenerativeAI | null => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    if (!embeddingClientState.client) {
        embeddingClientState.client = new GoogleGenerativeAI(apiKey);
    }
    return embeddingClientState.client;
};

/**
 * Generate an embedding vector for the given text using Gemini.
 * Returns null when no API key is configured or all models fail.
 */
export const generateQueryVector = async (
    queryText: string
): Promise<number[] | null> => {
    const client = getClient();
    if (!client) return null;
    const config = getJobEmbeddingConfig();

    const values = await runEmbeddingRequestWithRetry(
        () => withSpan("llm.embedding", {
                "llm.provider": "gemini",
                "llm.model": config.JOB_EMBEDDING_MODEL,
                "llm.operation": "job.search.embedding",
            }, async (span) => {
                const model = client.getGenerativeModel({ model: config.JOB_EMBEDDING_MODEL });
                const result = await model.embedContent(queryText);
                const embeddingValues = result.embedding?.values;
                span.setAttribute("llm.request.status", Array.isArray(embeddingValues) ? "success" : "error");
                return embeddingValues;
            }),
    );
    if (!Array.isArray(values) || values.length === 0) return null;
    if (values.length !== config.JOB_EMBEDDING_DIMENSIONS) {
        throw new Error(
            `Query embedding dimension ${values.length} does not match configured dimension ${config.JOB_EMBEDDING_DIMENSIONS}`,
        );
    }
    return values;
};
