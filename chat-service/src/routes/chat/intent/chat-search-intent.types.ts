/** Message-level intent for job search vs exploration (see `ChatSearchIntentService`). */
export type ChatSearchIntent =
    | "BACKGROUND_INFORMATION"
    | "CAREER_TIMELINE_DISCOVERY"
    | "FUTURE_PLANNING"
    | "WORK_DIRECTION_INTENT"
    | "EXPLICIT_JOB_SEARCH"
    | "DOMAIN_EXPLORATION_INTENT"
    | "JOB_FOLLOW_UP"
    | "PIPELINE_ACCEPT"
    | "PIPELINE_REJECT"
    | "GENERAL_CONVERSATION";
