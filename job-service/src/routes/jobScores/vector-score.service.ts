/**
 * Cosine similarity between two vectors.
 * Returns 0 for empty or mismatched-length vectors.
 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
};

/**
 * Gemini text-embedding-004 similarity ranges for job matching:
 * - Unrelated profiles: ~0.30–0.40
 * - Adjacent skills:    ~0.50–0.60
 * - Good match:         ~0.70–0.80
 * - Near-identical:     ~0.85+
 */
const MIN_SIM = 0.35;
const MAX_SIM = 0.85;

/** Normalize a raw cosine similarity to a 0–100 match score. */
export const similarityToMatchScore = (similarity: number): number => {
    const normalized = (similarity - MIN_SIM) / (MAX_SIM - MIN_SIM);
    return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
};

/** Compute match score between a user embedding and a job embedding. */
export const computeVectorMatchScore = (
    userEmbedding: number[],
    jobEmbedding: number[]
): number => {
    const similarity = cosineSimilarity(userEmbedding, jobEmbedding);
    return similarityToMatchScore(similarity);
};
