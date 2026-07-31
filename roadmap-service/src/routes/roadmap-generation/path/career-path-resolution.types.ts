export type CareerPathStep = {
    readonly role: string;
    readonly focus: string;
};

export type ResolvedCareerPath = {
    readonly steps: readonly string[];
    readonly reasonCodes: readonly string[];
};
