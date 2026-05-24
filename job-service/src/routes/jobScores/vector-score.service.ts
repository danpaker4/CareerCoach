export const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
};

const MIN_SIM = 0.35;
const MAX_SIM = 0.85;

export const similarityToMatchScore = (similarity: number): number => {
    const normalized = (similarity - MIN_SIM) / (MAX_SIM - MIN_SIM);
    const clamped = Math.max(0, Math.min(1, normalized));
    return Math.round(clamped * 100);
};

export const computeVectorMatchScore = (
    userEmbedding: number[],
    jobEmbedding: number[]
): number => {
    const similarity = cosineSimilarity(userEmbedding, jobEmbedding);
    return similarityToMatchScore(similarity);
};
