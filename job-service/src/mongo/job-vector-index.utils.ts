import {
    JOB_VECTOR_CREATED_AT_FILTER_PATH,
    JOB_VECTOR_PATH,
    JOB_VECTOR_SIMILARITY,
} from "./job-vector-index.consts";
import type {
    JobVectorIndexDefinition,
    SearchIndexFieldState,
    SearchIndexState,
} from "./job-vector-index.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const toNullableString = (value: unknown): string | null =>
    typeof value === "string" ? value : null;

const toNullableNumber = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

const parseField = (value: unknown): SearchIndexFieldState | null => {
    if (!isRecord(value) || typeof value.type !== "string") return null;
    return {
        type: value.type,
        path: toNullableString(value.path),
        numDimensions: toNullableNumber(value.numDimensions),
        similarity: toNullableString(value.similarity),
    };
};

const getDefinition = (value: Record<string, unknown>): Record<string, unknown> | null => {
    if (isRecord(value.latestDefinition)) return value.latestDefinition;
    return isRecord(value.definition) ? value.definition : null;
};

export const parseSearchIndexState = (value: unknown): SearchIndexState | null => {
    if (!isRecord(value) || typeof value.name !== "string") return null;
    const definition = getDefinition(value);
    const rawFields = definition && Array.isArray(definition.fields) ? definition.fields : [];
    const fields = rawFields
        .map(parseField)
        .filter((field): field is SearchIndexFieldState => field !== null);
    return {
        name: value.name,
        status: toNullableString(value.status),
        queryable: value.queryable === true,
        fields,
    };
};

export const createJobVectorIndexDefinition = (dimensions: number): JobVectorIndexDefinition => ({
    fields: [
        {
            type: "vector",
            numDimensions: dimensions,
            path: JOB_VECTOR_PATH,
            similarity: JOB_VECTOR_SIMILARITY,
        },
        {
            type: "filter",
            path: JOB_VECTOR_CREATED_AT_FILTER_PATH,
        },
    ],
});

export const isExpectedJobVectorIndex = (state: SearchIndexState, dimensions: number): boolean => {
    const vectorField = state.fields.find(
        (field) =>
            field.type === "vector" &&
            field.path === JOB_VECTOR_PATH &&
            field.numDimensions === dimensions &&
            field.similarity === JOB_VECTOR_SIMILARITY,
    );
    const createdAtFilter = state.fields.find(
        (field) =>
            field.type === "filter" &&
            field.path === JOB_VECTOR_CREATED_AT_FILTER_PATH,
    );
    return Boolean(vectorField && createdAtFilter);
};

export const isSearchIndexReady = (state: SearchIndexState, dimensions: number): boolean =>
    isExpectedJobVectorIndex(state, dimensions) &&
    (state.queryable || state.status?.toUpperCase() === "READY");

export const delay = (milliseconds: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
