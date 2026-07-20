import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
// TODO: move scoring config to be custom by user (store per-user overrides in DB)
import scoringConfig from "./scoring-config.json";

// ── Types ──────────────────────────────────────────────────────────────

type ScoringCategoryConfig = {
    name: string;
    weight: number;
    jobFields: (keyof Pick<
        EnrichedJob,
        "requirements" | "mustKnowSkills" | "niceToHaveSkills" |
        "languages" | "frameworks" | "databases" | "platforms" | "tools"
    >)[];
};

type ScoringConfigShape = {
    categories: ScoringCategoryConfig[];
    aliases: [string, string][];
};

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

// ── Alias map ──────────────────────────────────────────────────────────

function buildAliasMap(aliases: [string, string][]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();

    const register = (a: string, b: string) => {
        const la = a.toLowerCase();
        const lb = b.toLowerCase();
        if (!map.has(la)) map.set(la, new Set([la]));
        if (!map.has(lb)) map.set(lb, new Set([lb]));
        map.get(la)!.add(lb);
        map.get(lb)!.add(la);
    };

    for (const [a, b] of aliases) register(a, b);
    return map;
}

const aliasMap = buildAliasMap(scoringConfig.aliases as [string, string][]);

// ── Fuzzy matching ─────────────────────────────────────────────────────

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s#+.]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 0);
}

function expandWithAliases(term: string): string[] {
    const lower = term.toLowerCase();
    const aliases = aliasMap.get(lower);
    return aliases ? Array.from(aliases) : [lower];
}

function fuzzyMatch(requirement: string, skill: string): boolean {
    const reqLower = requirement.toLowerCase().trim();
    const skillLower = skill.toLowerCase().trim();

    // 1. Exact match
    if (reqLower === skillLower) return true;

    // 2. Alias match — expand both sides and check overlap
    const reqAliases = expandWithAliases(reqLower);
    const skillAliases = expandWithAliases(skillLower);
    if (reqAliases.some((ra) => skillAliases.includes(ra))) return true;

    // 3. Substring containment
    if (reqLower.includes(skillLower) || skillLower.includes(reqLower)) return true;

    // 4. Token overlap — multi-word terms like "React Native" matching "React"
    const reqTokens = tokenize(reqLower);
    const skillTokens = tokenize(skillLower);

    const allSkillTokensMatch = skillTokens.length > 0 && skillTokens.every((st) =>
        reqTokens.some((rt) => rt === st || rt.includes(st) || st.includes(rt))
    );
    if (allSkillTokensMatch) return true;

    const allReqTokensMatch = reqTokens.length > 0 && reqTokens.every((rt) =>
        skillTokens.some((st) => st === rt || st.includes(rt) || rt.includes(st))
    );
    if (allReqTokensMatch) return true;

    return false;
}

// ── Scoring ────────────────────────────────────────────────────────────

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

function resolveJobFields(job: EnrichedJob, fields: ScoringCategoryConfig["jobFields"]): string[] {
    const result: string[] = [];
    for (const f of fields) {
        const arr = job[f];
        if (Array.isArray(arr)) result.push(...arr);
    }
    return result;
}

// ── Main entry point ───────────────────────────────────────────────────

const cfg = scoringConfig as ScoringConfigShape;

export function computeJobScore(job: EnrichedJob, userSkills: string[]): ComputeResult {
    const rawCategories = cfg.categories.map((c) => ({
        name: c.name,
        weight: c.weight,
        requirements: resolveJobFields(job, c.jobFields),
    }));

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
