import type { AchievementInferenceResult, InferredAchievement } from "./achievement-inference.types";

const RULES: Array<{ trigger: readonly string[]; inferred: readonly string[]; title: string }> = [
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

const extractExplicitSkills = (message: string): string[] => {
    const lowered = message.toLowerCase();
    const candidates = ["Node.js", "MongoDB", "TypeScript", "JavaScript", "Redis", "Kafka", "Cypress", "Playwright", "Docker", "Kubernetes", "React", "Angular"];
    return candidates.filter((skill) => lowered.includes(skill.toLowerCase()));
};

export class AchievementInferenceService {
    inferFromMessage = (message: string): AchievementInferenceResult => {
        const lowered = message.toLowerCase();
        const explicit = extractExplicitSkills(message);
        const achievements: InferredAchievement[] = [];

        for (const rule of RULES) {
            if (!rule.trigger.some((trigger) => lowered.includes(trigger))) {
                continue;
            }
            achievements.push({
                title: rule.title,
                description: message,
                skills: explicit,
                inferredSkills: [...rule.inferred],
                confidence: 0.72,
                evidence: message,
            });
        }

        if (achievements.length === 0 && explicit.length > 0) {
            achievements.push({
                title: "Technical skills mentioned",
                description: message,
                skills: explicit,
                inferredSkills: [],
                confidence: 0.65,
                evidence: message,
            });
        }

        return { achievements };
    };
}
