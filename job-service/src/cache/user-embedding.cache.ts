interface CacheEntry {
    readonly embedding: number[];
    readonly expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1_000;

export class UserEmbeddingCache {
    private readonly store = new Map<string, CacheEntry>();
    private readonly ttlMs: number;

    constructor(ttlMs = DEFAULT_TTL_MS) {
        this.ttlMs = ttlMs;
    }

    get(userId: string): number[] | null {
        const entry = this.store.get(userId);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(userId);
            return null;
        }
        return entry.embedding;
    }

    set(userId: string, embedding: number[]): void {
        this.store.set(userId, {
            embedding,
            expiresAt: Date.now() + this.ttlMs,
        });
    }

    invalidate(userId: string): void {
        this.store.delete(userId);
    }

    get size(): number {
        return this.store.size;
    }
}
