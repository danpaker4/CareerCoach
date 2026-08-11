export type PublicJobSource = "remotive" | "arbeitnow" | "jobicy";

export type NormalizedPublicJob = {
    readonly jobTitle: string;
    readonly company: string;
    readonly description: string;
    readonly seniority: string;
    readonly location?: string;
    readonly salary?: number;
    readonly requirements?: string[];
    readonly url?: string;
    readonly source: PublicJobSource;
};

export type ImportOutcome = {
    fetched: number;
    created: number;
    skipped: number;
    failed: number;
};
