import type { ChatSearchIntent } from "./chat-search-intent.types";

const EXPLICIT_JOB_SEARCH_SIGNALS = [
    "show me jobs",
    "find jobs",
    "search jobs",
    "job search",
    "search for jobs",
    "look for jobs",
    "open positions",
    "vacancies",
    "apply now",
    "apply for",
    "job listings",
    "hiring",
    "linkedin jobs",
    "what jobs",
    "any jobs",
    "list jobs",
    "got openings",
];

const BACKGROUND_ROLE_PHRASES = [
    "i work as",
    "i'm working as",
    "im working as",
    "i am working as",
    "working as a",
    "working as an",
    "i am a",
    "i'm a",
    "im a",
    "i work in",
    "i'm working in",
    "i study",
    "studying",
    "computer science",
    "years experience",
    "years of experience",
    "software developer",
    "software engineer",
    "developer for",
    "i know ",
    "i worked with",
    "i worked in",
    "i have experience",
    "my background",
    "currently i",
];

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Avoid substring false positives (e.g. `java` inside `software`). */
const hasWholeWord = (haystack: string, needle: string): boolean => {
    const trimmed = needle.trim().toLowerCase();
    if (trimmed.length === 0) {
        return false;
    }
    if (trimmed.length <= 4) {
        return new RegExp(`\\b${escapeRegex(trimmed)}\\b`, "i").test(haystack);
    }
    return haystack.includes(trimmed);
};

export type DomainExplorationTarget = {
    domain: string;
    keywords: readonly string[];
    roleHints: readonly string[];
    intro: string;
};

const DOMAIN_EXPLORATION_PHRASES = [
    "what roles are there",
    "what can i do",
    "what jobs are there",
    "what can you offer me",
    "show me opportunities",
    "what exists in",
    "what can i become",
    "what are the directions",
];

export const DOMAIN_TARGETS: readonly DomainExplorationTarget[] = [
    {
        domain: "cybersecurity",
        keywords: ["cybersecurity", "security analyst", "soc", "application security", "qa security testing", "junior cyber"],
        roleHints: ["SOC Analyst", "Security Analyst", "Application Security", "Penetration Tester", "GRC Analyst", "IAM Engineer", "Cloud Security", "DevSecOps", "Security Automation", "Threat Intelligence", "Incident Response"],
        intro: "Based on your background, strong cybersecurity directions include SOC Analyst, Security QA, Application Security Testing, and Junior Security Analyst.",
    },
    {
        domain: "ai",
        keywords: ["ai", "machine learning", "llm", "ml engineer", "ai engineer"],
        roleHints: ["ML Engineer", "AI Engineer", "LLM Application Engineer", "Data Scientist"],
        intro: "AI directions include ML Engineer, AI Engineer, LLM Application Engineer, and Data Scientist.",
    },
    {
        domain: "backend",
        keywords: ["backend", "api", "node.js", "java", "python backend"],
        roleHints: ["Backend Engineer", "Platform Engineer", "API Engineer"],
        intro: "Backend directions include Backend Engineer, API Engineer, and Platform Engineer.",
    },
    {
        domain: "devops",
        keywords: ["devops", "platform", "sre", "infrastructure", "kubernetes"],
        roleHints: ["DevOps Engineer", "SRE", "Platform Engineer", "Cloud Engineer"],
        intro: "DevOps directions include DevOps Engineer, SRE, Platform Engineer, and Cloud Engineer.",
    },
    {
        domain: "data",
        keywords: ["data", "analytics", "data engineer", "bi", "data analyst"],
        roleHints: ["Data Analyst", "Data Engineer", "BI Developer"],
        intro: "Data directions include Data Analyst, Data Engineer, and BI Developer.",
    },
    {
        domain: "frontend",
        keywords: ["frontend", "react", "ui", "web", "javascript"],
        roleHints: ["Frontend Engineer", "UI Engineer", "Web Engineer"],
        intro: "Frontend directions include Frontend Engineer, UI Engineer, and Web Engineer.",
    },
    {
        domain: "cloud",
        keywords: ["cloud", "aws", "azure", "gcp", "cloud engineer"],
        roleHints: ["Cloud Engineer", "Cloud Security Engineer", "Platform Engineer"],
        intro: "Cloud directions include Cloud Engineer, Cloud Security Engineer, and Platform Engineer.",
    },
] as const;

const WORK_DIRECTION_PHRASES = [
    "i want to work in",
    "i'm interested in",
    "im interested in",
    "sounds interesting",
    "i want a job in",
    "i want to be",
    "can i work in",
    "what jobs are there in",
    "what can you offer in",
    "find me",
    "show me jobs in",
    "fits me",
    "maybe",
    "let's go with",
    "lets go with",
    "i choose",
    "i want to start with",
    "search to me a job as",
    "search me a job as",
];

export class ChatSearchIntentService {
    detectDomainExplorationTarget = (message: string): DomainExplorationTarget | null => {
        const normalized = message.toLowerCase();
        const asksDomainExploration = DOMAIN_EXPLORATION_PHRASES.some((phrase) => normalized.includes(phrase));
        const matchedDomain = DOMAIN_TARGETS.find((target) =>
            target.keywords.some((keyword) => hasWholeWord(normalized, keyword)) || hasWholeWord(normalized, target.domain)
        );
        if (!matchedDomain) {
            return null;
        }
        if (asksDomainExploration) {
            return matchedDomain;
        }
        const directOpportunityAsk =
            normalized.includes("opportunities") || normalized.includes("jobs in") || normalized.includes("what can i");
        return directOpportunityAsk ? matchedDomain : null;
    };

    normalizeWorkDirection = (raw: string): string => {
        const normalized = raw.trim().replace(/\s+/g, " ");
        const fixLeadingJ = normalized.replace(/\bunior\b/gi, "Junior");
        const fixCyber = fixLeadingJ.replace(/\bcyber\s*security\b/gi, "cybersecurity");
        return fixCyber;
    };

    extractWorkDirectionQuery = (message: string): string | null => {
        const normalized = message.trim();
        const lowered = normalized.toLowerCase();
        const regexMatches = [
            /i want to work in\s+(.+)/i,
            /i want a job in\s+(.+)/i,
            /i want to be\s+(.+)/i,
            /want\s+(?:a\s+)?(?:new\s+)?job\s+as\s+(?:a\s+)?(.+)/i,
            /need\s+(?:a\s+)?job\s+as\s+(?:a\s+)?(.+)/i,
            /looking\s+for\s+(?:a\s+)?job\s+as\s+(?:a\s+)?(.+)/i,
            /search(?:\s+to)?\s+me\s+a\s+job\s+as\s+(?:a\s+)?(.+)/i,
            /find me\s+(.+?)\s+jobs?/i,
            /show me jobs in\s+(.+)/i,
            /what jobs are there in\s+(.+)/i,
            /what can you offer(?: me)? in\s+(.+)/i,
            /i think\s+(.+)\s+fits me/i,
            /maybe\s+(.+)/i,
            /let'?s go with\s+(.+)/i,
            /i choose\s+(.+)/i,
            /i want to start with\s+(.+)/i,
            /(.+)\s+sounds?\s+(?:good|interesting|intersting)/i,
        ];
        for (const pattern of regexMatches) {
            const match = normalized.match(pattern);
            const candidate = match?.[1]?.trim();
            if (candidate) {
                return this.normalizeWorkDirection(candidate);
            }
        }
        const trigger = WORK_DIRECTION_PHRASES.find((phrase) => lowered.includes(phrase));
        if (!trigger) {
            return null;
        }

        const triggerIndex = lowered.indexOf(trigger);
        const suffix = normalized.slice(triggerIndex + trigger.length).trim().replace(/^[\s:,-]+/, "");
        if (suffix.length > 0) {
            return this.normalizeWorkDirection(suffix);
        }

        const domainTarget = DOMAIN_TARGETS.find(
            (target) =>
                target.keywords.some((keyword) => hasWholeWord(lowered, keyword)) || hasWholeWord(lowered, target.domain)
        );
        if (domainTarget) {
            return this.normalizeWorkDirection(domainTarget.domain);
        }
        return null;
    };

    isWorkDirectionIntent = (message: string): boolean => {
        const lowered = message.toLowerCase();
        const extractedDirection = this.extractWorkDirectionQuery(message);
        if (extractedDirection) {
            return true;
        }
        const interestPattern = /\b(interested|interesting|intersting|fits me|maybe|choose|start with)\b/i;
        const domainMentioned = DOMAIN_TARGETS.some(
            (target) =>
                target.keywords.some((keyword) => hasWholeWord(lowered, keyword)) || hasWholeWord(lowered, target.domain)
        );
        if (interestPattern.test(lowered) && domainMentioned) {
            return true;
        }
        if (/search.*job.*as/i.test(lowered) || /\bi want to be\b/i.test(lowered)) {
            return true;
        }
        const jobContextWord =
            /\bjobs?\b/.test(lowered)
            || /\brole\b/.test(lowered)
            || /\bdirection\b/.test(lowered)
            || /\boffer\b/.test(lowered)
            || (/\bwork\b/.test(lowered) && !/\bworking\b/.test(lowered));
        return (
            domainMentioned
            && jobContextWord
        );
    };

    isExplicitJobSearchIntent = (normalized: string): boolean =>
        EXPLICIT_JOB_SEARCH_SIGNALS.some((phrase) => normalized.includes(phrase));

    isBackgroundInformationIntent = (normalized: string): boolean => {
        if (this.isExplicitJobSearchIntent(normalized)) {
            return false;
        }
        if (this.isWorkDirectionIntent(normalized)) {
            return false;
        }
        if (this.detectDomainExplorationTarget(normalized) !== null) {
            return false;
        }
        return BACKGROUND_ROLE_PHRASES.some((phrase) => normalized.includes(phrase));
    };

    detectSearchIntent = (
        normalizedMessage: string,
        pipelineIntent: "PIPELINE_ACCEPT" | "PIPELINE_REJECT" | null,
        followUpIsJobFollowUp: boolean
    ): ChatSearchIntent => {
        const normalized = normalizedMessage.toLowerCase();
        if (pipelineIntent === "PIPELINE_ACCEPT") {
            return "PIPELINE_ACCEPT";
        }
        if (pipelineIntent === "PIPELINE_REJECT") {
            return "PIPELINE_REJECT";
        }
        if (followUpIsJobFollowUp) {
            return "JOB_FOLLOW_UP";
        }
        if (this.isExplicitJobSearchIntent(normalized)) {
            return "EXPLICIT_JOB_SEARCH";
        }
        if (this.detectDomainExplorationTarget(normalizedMessage) !== null) {
            return "DOMAIN_EXPLORATION_INTENT";
        }
        if (this.isWorkDirectionIntent(normalizedMessage)) {
            return "WORK_DIRECTION_INTENT";
        }
        if (this.isBackgroundInformationIntent(normalized)) {
            return "BACKGROUND_INFORMATION";
        }
        return "GENERAL_CONVERSATION";
    };

    allowsMongoJobSearch = (params: {
        readonly careerPlanningMode: "UNKNOWN" | "IMMEDIATE" | "FUTURE_PLANNING";
        readonly intent: ChatSearchIntent;
    }): boolean => {
        if (params.careerPlanningMode !== "IMMEDIATE") {
            return false;
        }
        return (
            params.intent === "WORK_DIRECTION_INTENT"
            || params.intent === "EXPLICIT_JOB_SEARCH"
            || params.intent === "DOMAIN_EXPLORATION_INTENT"
        );
    };

    allowsPipelineClosingQuestion = (params: {
        readonly careerPlanningMode: "UNKNOWN" | "IMMEDIATE" | "FUTURE_PLANNING";
        readonly intent: ChatSearchIntent;
    }): boolean => {
        if (params.careerPlanningMode !== "IMMEDIATE") {
            return false;
        }
        return (
            params.intent === "WORK_DIRECTION_INTENT"
            || params.intent === "EXPLICIT_JOB_SEARCH"
            || params.intent === "DOMAIN_EXPLORATION_INTENT"
            || params.intent === "JOB_FOLLOW_UP"
            || params.intent === "PIPELINE_REJECT"
        );
    };
}
