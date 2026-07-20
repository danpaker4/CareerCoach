export type ConversationMode = "DREAMJOB" | "NEAR_TERM" | "GUIDED";

export type ConversationModeDetectionResult = {
    mode: ConversationMode;
    /** 0-100: how much of the information required by the selected mode is already collected. */
    readinessScore: number;
    /** True when the selected mode can proceed to its next step now. */
    isReady: boolean;
    /** Concrete details to collect before the selected mode can continue. */
    missingInformation: string[];
    /** Only for DREAMJOB mode: the extracted dream job title to save. */
    dreamJobTitle?: string;
    /** Only for NEAR_TERM mode: true when the system should start searching jobs now. */
    shouldSearchJobs: boolean;
    /** Only for NEAR_TERM mode: the job title or domain to search for. */
    searchQuery?: string;
};
