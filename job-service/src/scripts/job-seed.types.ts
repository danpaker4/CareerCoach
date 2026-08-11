export interface JobSeed {
    readonly id: string;
    readonly jobTitle: string;
    readonly url: string;
    readonly company: string;
    readonly seniority: string;
    readonly description: string;
    readonly location?: string;
    readonly lon: number | null;
    readonly lat: number | null;
    readonly salary: number;
    readonly requirements: readonly string[];
    readonly benefits: readonly string[];
    readonly languages: readonly string[];
    readonly frameworks: readonly string[];
    readonly databases: readonly string[];
    readonly platforms: readonly string[];
    readonly tools: readonly string[];
    readonly mustKnowSkills: readonly string[];
    readonly niceToHaveSkills: readonly string[];
    readonly searchableText: string;
}
