export const JOBS_PAGE_SIZE = 50;
export const JOBS_PAGE_LOOKAHEAD = 1;
/** Minimum fit used by roadmap stage opportunities. */
export const MIN_MATCH_FIT_PCT = 80;
/** Minimum query match for Job Suggestions when a search query is present. */
export const JOBS_LIST_MIN_MATCH_FIT_PCT = 20;
/** Extra vector candidates fetched before applying JOBS_LIST_MIN_MATCH_FIT_PCT, so pages stay full. */
export const HIGH_MATCH_OVERFETCH_MULTIPLIER = 10;
/** Blend of embedding similarity vs keyword overlap for displayed search match %. */
export const SEARCH_VECTOR_MATCH_WEIGHT = 0.55;
export const SEARCH_LEXICAL_MATCH_WEIGHT = 0.45;
export const MIN_VECTOR_CANDIDATES = 1_000;
export const MAX_VECTOR_CANDIDATES = 10_000;
export const VECTOR_CANDIDATE_MULTIPLIER = 20;
