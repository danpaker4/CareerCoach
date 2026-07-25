export interface JobVectorIndexDefinition {
    fields: ReadonlyArray<
        | {
            type: "vector";
            numDimensions: number;
            path: string;
            similarity: "cosine";
        }
        | {
            type: "filter";
            path: string;
        }
    >;
}

export interface SearchIndexFieldState {
    type: string;
    path: string | null;
    numDimensions: number | null;
    similarity: string | null;
}

export interface SearchIndexState {
    name: string;
    status: string | null;
    queryable: boolean;
    fields: readonly SearchIndexFieldState[];
}
