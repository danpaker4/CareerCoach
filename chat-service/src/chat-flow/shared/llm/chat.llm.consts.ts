import type { JobSearchRequest } from "../../api/shared/chat.types";

export const EMPTY_LLM_SEARCH_FILTERS: JobSearchRequest = {
    skills: [],
    interests: [],
    experienceLevel: "",
    keywords: [],
};

export const LLM_DECISION_PARSE_FALLBACK_REPLIES = {
    achievements: "What project, responsibility, or accomplishment best shows what you can do?",
    timeline: "Are you looking for your next role soon, or exploring a longer-term direction?",
    preferences: "What kind of work do you want more of in your next role?",
    default: "What career goal would you like help with right now?",
} as const;
