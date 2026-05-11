import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";

type ScoreCategory = {
    category: string;
    score: number;
    weight: number;
    matched: string[];
    unmatched: string[];
};

type ComputeResult = {
    categories: ScoreCategory[];
    overallScore: number;
    userSkillsUsed: string[];
};

function fuzzyMatch(requirement: string, skill: string): boolean {
    const req = requirement.toLowerCase();
    const s = skill.toLowerCase();
    return req.includes(s) || s.includes(req);
}

function scoreCategory(
    categoryName: string,
    weight: number,
    requirements: string[],
    userSkills: string[]
): ScoreCategory {
    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const req of requirements) {
        const isMatched = userSkills.some((skill) => fuzzyMatch(req, skill));
        if (isMatched) {
            matched.push(req);
        } else {
            unmatched.push(req);
        }
    }

    const score = requirements.length > 0
        ? Math.round((matched.length / requirements.length) * 100)
        : 0;

    return { category: categoryName, score, weight, matched, unmatched };
}

export function computeJobScore(job: EnrichedJob, userSkills: string[]): ComputeResult {
    const rawCategories: { name: string; weight: number; requirements: string[] }[] = [
        {
            name: "Core Requirements",
            weight: 0.40,
            requirements: [...job.requirements, ...job.mustKnowSkills],
        },
        {
            name: "Languages & Frameworks",
            weight: 0.25,
            requirements: [...job.languages, ...job.frameworks],
        },
        {
            name: "Tools & Infrastructure",
            weight: 0.20,
            requirements: [...job.databases, ...job.platforms, ...job.tools],
        },
        {
            name: "Nice-to-Have",
            weight: 0.15,
            requirements: [...job.niceToHaveSkills],
        },
    ];

    // Filter out empty categories and redistribute weight
    const nonEmpty = rawCategories.filter((c) => c.requirements.length > 0);
    const totalWeight = nonEmpty.reduce((sum, c) => sum + c.weight, 0);

    const categories: ScoreCategory[] = nonEmpty.map((c) => {
        const redistributedWeight = totalWeight > 0 ? c.weight / totalWeight : 0;
        return scoreCategory(c.name, redistributedWeight, c.requirements, userSkills);
    });

    const overallScore = Math.round(
        categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0)
    );

    const userSkillsUsed = userSkills.filter((skill) =>
        categories.some((cat) => cat.matched.some((m) => fuzzyMatch(m, skill)))
    );

    return { categories, overallScore, userSkillsUsed };
}
