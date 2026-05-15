import type { JobSearchRequest } from "../chat.types";

type JobSearchStrategyType = "STRICT_MATCH" | "SEMANTIC_PROFILE" | "EXPLORATORY" | "ADJACENT" | "GROWTH_PATH";

export type JobSearchPlanItem = {
    type: JobSearchStrategyType;
    query: string;
    filters: JobSearchRequest;
};

export type JobSearchPlan = {
    searches: JobSearchPlanItem[];
};
