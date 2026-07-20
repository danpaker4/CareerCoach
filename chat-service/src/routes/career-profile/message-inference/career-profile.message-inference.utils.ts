import { EXPLICIT_USER_SIGNAL_CONFIDENCE } from "../career-profile.consts";
import type { CareerProfileSignalUpdate, CareerSignal } from "../career-profile.types";

const toSignal = (
    value: string,
    evidence: string,
    source: CareerSignal["source"],
    confidence = EXPLICIT_USER_SIGNAL_CONFIDENCE
): CareerSignal => ({
    value: value.trim(),
    confidence,
    evidence: [evidence],
    source,
    updatedAt: new Date(),
});

const splitByCommonDelimiters = (value: string): string[] =>
    value
        .split(/[,\n/|]/g)
        .map((item) => item.trim())
        .filter((item) => item.length > 1);

const extractKnownTechnologies = (message: string): string[] => {
    const canonicalMap: Record<string, string> = {
        nodejs: "Node.js",
        "node.js": "Node.js",
        node: "Node.js",
        mongodb: "MongoDB",
        mongo: "MongoDB",
        typescript: "TypeScript",
        javascript: "JavaScript",
        react: "React",
        angular: "Angular",
        cypress: "Cypress",
        kafka: "Kafka",
        redis: "Redis",
        docker: "Docker",
        kubernetes: "Kubernetes",
        python: "Python",
        java: "Java",
    };

    const lowered = message.toLowerCase();
    const found = new Set<string>();
    for (const [term, canonical] of Object.entries(canonicalMap)) {
        if (lowered.includes(term)) {
            found.add(canonical);
        }
    }
    return [...found];
};

export const inferProfileUpdateFromMessage = (message: string): CareerProfileSignalUpdate => {
    const lowered = message.toLowerCase();
    const technologies = extractKnownTechnologies(message).map((item) => toSignal(item, message, "chat"));
    const interests: CareerSignal[] = [];
    const dislikes: CareerSignal[] = [];
    const motivations: CareerSignal[] = [];
    const preferredRoles: CareerSignal[] = [];

    if (lowered.includes("i like") || lowered.includes("i enjoy") || lowered.includes("love")) {
        const afterLike = message.split(/i like|i enjoy|love/gi).slice(1).join(" ");
        for (const value of splitByCommonDelimiters(afterLike)) {
            interests.push(toSignal(value, message, "chat", 0.78));
        }
    }
    if (lowered.includes("i don't like") || lowered.includes("i dislike") || lowered.includes("i hate")) {
        const afterDislike = message.split(/i don't like|i dislike|i hate/gi).slice(1).join(" ");
        for (const value of splitByCommonDelimiters(afterDislike)) {
            dislikes.push(toSignal(value, message, "chat", 0.78));
        }
    }
    if (lowered.includes("i want") || lowered.includes("goal")) {
        motivations.push(toSignal(message, message, "chat", 0.65));
    }
    if (lowered.includes("backend") || lowered.includes("frontend") || lowered.includes("fullstack") || lowered.includes("qa")) {
        const roleHints = ["Backend Engineer", "Frontend Engineer", "Fullstack Engineer", "QA Engineer"];
        const matched = roleHints.filter((item) => lowered.includes(item.split(" ")[0]?.toLowerCase() ?? ""));
        for (const role of matched) {
            preferredRoles.push(toSignal(role, message, "llm_inference", 0.58));
        }
    }

    const uncertaintyLevel = lowered.includes("don't know") || lowered.includes("not sure") || lowered.includes("no idea")
        ? 0.85
        : lowered.includes("i want") || preferredRoles.length > 0
            ? 0.35
            : undefined;

    return {
        technologies,
        interests,
        dislikes,
        motivations,
        preferredRoles,
        extractedKeywords: [...extractKnownTechnologies(message), ...splitByCommonDelimiters(message).slice(0, 4)].map((item) =>
            toSignal(item, message, "llm_inference", 0.52)
        ),
        uncertaintyLevel,
    };
};
