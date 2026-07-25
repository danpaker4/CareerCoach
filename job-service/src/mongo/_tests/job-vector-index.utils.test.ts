import { describe, expect, it } from "vitest";
import {
    createJobVectorIndexDefinition,
    isExpectedJobVectorIndex,
    isSearchIndexReady,
    parseSearchIndexState,
} from "../job-vector-index.utils";

describe("job vector index utilities", () => {
    it("creates the self-managed vector index definition", () => {
        expect(createJobVectorIndexDefinition(3_072)).toEqual({
            fields: [
                {
                    type: "vector",
                    numDimensions: 3_072,
                    path: "searchEmbedding",
                    similarity: "cosine",
                },
                {
                    type: "filter",
                    path: "createdAt",
                },
            ],
        });
    });

    it("recognizes a queryable index with the expected fields", () => {
        const state = parseSearchIndexState({
            name: "jobs-vector",
            status: "READY",
            queryable: true,
            latestDefinition: createJobVectorIndexDefinition(3_072),
        });

        expect(state).not.toBeNull();
        if (!state) return;
        expect(isExpectedJobVectorIndex(state, 3_072)).toBe(true);
        expect(isSearchIndexReady(state, 3_072)).toBe(true);
    });

    it("rejects an index built for another embedding dimension", () => {
        const state = parseSearchIndexState({
            name: "jobs-vector",
            status: "READY",
            queryable: true,
            latestDefinition: createJobVectorIndexDefinition(1_536),
        });

        expect(state).not.toBeNull();
        if (!state) return;
        expect(isExpectedJobVectorIndex(state, 3_072)).toBe(false);
        expect(isSearchIndexReady(state, 3_072)).toBe(false);
    });
});
