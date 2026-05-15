export type AchievementInferenceRule = {
    trigger: readonly string[];
    inferred: readonly string[];
    title: string;
};

export const ACHIEVEMENT_INFERENCE_RULES: readonly AchievementInferenceRule[] = [
    {
        trigger: ["cypress", "playwright", "automation test", "qa automation"],
        inferred: ["QA automation", "test automation", "regression testing", "frontend testing", "reliability"],
        title: "Quality automation experience",
    },
    {
        trigger: ["redis", "kafka", "queue", "event"],
        inferred: ["backend engineering", "distributed systems", "event-driven architecture", "scalability", "async communication"],
        title: "Distributed backend experience",
    },
    {
        trigger: ["mongo", "mongodb", "node", "nodejs"],
        inferred: ["backend development", "api design", "data modeling"],
        title: "Node and Mongo development",
    },
];

const EXPLICIT_SKILL_CANDIDATES = [
    "Node.js",
    "MongoDB",
    "TypeScript",
    "JavaScript",
    "Redis",
    "Kafka",
    "Cypress",
    "Playwright",
    "Docker",
    "Kubernetes",
    "React",
    "Angular",
] as const;

export const mergeUniqueStrings = (items: readonly string[]): string[] =>
    [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];

export const extractExplicitSkills = (message: string): string[] => {
    const lowered = message.toLowerCase();
    return EXPLICIT_SKILL_CANDIDATES.filter((skill) => lowered.includes(skill.toLowerCase()));
};

export const toUserAchievementFromInferred = (inferred: {
    title: string;
    confidence: number;
}): { id: string; name: string; grade: number } => ({
    id: crypto.randomUUID(),
    name: inferred.title,
    grade: Math.round(inferred.confidence * 100),
});
