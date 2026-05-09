import type { JobSearchRequest } from "../chat.types";

export const EMPTY_LLM_SEARCH_FILTERS: JobSearchRequest = {
    skills: [],
    interests: [],
    experienceLevel: "",
    keywords: [],
};

export const LLM_DECISION_PARSE_FALLBACK_REPLY =
    "Thanks, that helps. Could you share the type of role and tech stack you enjoy most?";

export const LLM_JOB_AWARE_PARSE_FALLBACK_REPLY =
    "I found relevant jobs. Tell me which one sounds closest to your goals, and I will help you refine it.";

export const LLM_STAGE_PARSE_FALLBACK_REPLY =
    "Got it. Can you share a bit more detail so I can guide you better?";
