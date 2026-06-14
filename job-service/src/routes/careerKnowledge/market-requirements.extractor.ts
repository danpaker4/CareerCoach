const RESPONSIBILITY_KEYWORDS = [
    "lead",
    "own",
    "design",
    "build",
    "maintain",
    "mentor",
    "collaborate",
    "deliver",
    "implement",
    "architect",
    "review",
    "manage",
    "drive",
    "coordinate",
    "optimize",
    "scale",
    "deploy",
    "monitor",
    "test",
    "document",
];

const LEADERSHIP_KEYWORDS = [
    "lead",
    "mentor",
    "manage",
    "coach",
    "hire",
    "team",
    "people",
    "cross-functional",
    "stakeholder",
    "influence",
    "guide",
    "supervise",
];

const ARCHITECTURE_KEYWORDS = [
    "architect",
    "architecture",
    "system design",
    "scalability",
    "distributed",
    "microservices",
    "infrastructure",
    "platform",
    "reliability",
    "performance",
    "security",
    "cloud",
    "api design",
    "data model",
];

const splitSentences = (text: string): string[] =>
    text
        .split(/[.\n;•]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10 && s.length < 300);

const matchKeywordSentences = (sentences: readonly string[], keywords: readonly string[]): string[] => {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    return sentences.filter((sentence) => {
        const lower = sentence.toLowerCase();
        return lowerKeywords.some((keyword) => lower.includes(keyword));
    });
};

export const extractResponsibilities = (description: string, requirements: readonly string[]): string[] => {
    const fromRequirements = requirements
        .filter((r) => RESPONSIBILITY_KEYWORDS.some((k) => r.toLowerCase().includes(k)))
        .slice(0, 15);
    const fromDescription = matchKeywordSentences(splitSentences(description), RESPONSIBILITY_KEYWORDS).slice(0, 10);
    const seen = new Set<string>();
    return [...fromRequirements, ...fromDescription].filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 20);
};

export const extractLeadershipSignals = (description: string, requirements: readonly string[]): string[] => {
    const combined = [...requirements, ...matchKeywordSentences(splitSentences(description), LEADERSHIP_KEYWORDS)];
    const seen = new Set<string>();
    return combined.filter((item) => {
        const lower = item.toLowerCase();
        if (!LEADERSHIP_KEYWORDS.some((k) => lower.includes(k))) return false;
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
    }).slice(0, 15);
};

export const extractArchitectureSignals = (
    description: string,
    requirements: readonly string[],
    platforms: readonly string[],
    tools: readonly string[]
): string[] => {
    const fromText = matchKeywordSentences(
        [...splitSentences(description), ...requirements],
        ARCHITECTURE_KEYWORDS
    );
    const fromTaxonomy = [...platforms, ...tools].filter((item) => item.trim().length > 0);
    const seen = new Set<string>();
    return [...fromText, ...fromTaxonomy].filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 20);
};

export type MarketRequirementsSummary = {
    roleCategory: string;
    commonSkills: string[];
    responsibilities: string[];
    leadershipSignals: string[];
    architectureSignals: string[];
    seniorityDistribution: Record<string, number>;
    sampleJobCount: number;
};

export const aggregateMarketRequirements = (
    roleCategory: string,
    jobs: ReadonlyArray<{
        seniority: string;
        requirements: string[];
        mustKnowSkills: string[];
        niceToHaveSkills: string[];
        description: string;
        platforms?: string[];
        tools?: string[];
    }>
): MarketRequirementsSummary => {
    const allSkills = jobs.flatMap((j) => [
        ...(j.mustKnowSkills ?? []),
        ...(j.niceToHaveSkills ?? []),
        ...(j.requirements ?? []),
    ]);
    const skillCounts = new Map<string, number>();
    for (const skill of allSkills) {
        const key = skill.trim();
        if (!key) continue;
        skillCounts.set(key, (skillCounts.get(key) ?? 0) + 1);
    }
    const commonSkills = [...skillCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([skill]) => skill);

    const responsibilities = jobs.flatMap((j) => extractResponsibilities(j.description ?? "", j.requirements ?? []));
    const leadershipSignals = jobs.flatMap((j) => extractLeadershipSignals(j.description ?? "", j.requirements ?? []));
    const architectureSignals = jobs.flatMap((j) =>
        extractArchitectureSignals(j.description ?? "", j.requirements ?? [], j.platforms ?? [], j.tools ?? [])
    );

    const seniorityDistribution = jobs.reduce<Record<string, number>>((acc, job) => {
        const key = job.seniority?.trim() || "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {});

    const dedupe = (items: string[]): string[] => {
        const seen = new Set<string>();
        return items.filter((item) => {
            const key = item.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    return {
        roleCategory,
        commonSkills,
        responsibilities: dedupe(responsibilities).slice(0, 20),
        leadershipSignals: dedupe(leadershipSignals).slice(0, 15),
        architectureSignals: dedupe(architectureSignals).slice(0, 15),
        seniorityDistribution,
        sampleJobCount: jobs.length,
    };
};
