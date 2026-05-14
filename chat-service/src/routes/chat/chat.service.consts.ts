import type { DomainExplorationTarget } from "./chat.service.types";

export const DOMAIN_EXPLORATION_PHRASES = [
    "what roles are there",
    "what can i do",
    "what jobs are there",
    "what can you offer me",
    "show me opportunities",
    "what exists in",
    "what can i become",
    "what are the directions",
] as const;

export const WORK_DIRECTION_PHRASES = [
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
    "as a",
] as const;

export const DOMAIN_TARGETS: readonly DomainExplorationTarget[] = [
    {
        domain: "cybersecurity",
        keywords: ["cybersecurity", "security analyst", "soc", "application security", "qa security testing", "junior cyber"],
        roleHints: [
            "SOC Analyst",
            "Security Analyst",
            "Application Security",
            "Penetration Tester",
            "GRC Analyst",
            "IAM Engineer",
            "Cloud Security",
            "DevSecOps",
            "Security Automation",
            "Threat Intelligence",
            "Incident Response",
        ],
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
];

export const STAGE_SKIP_SIGNALS = [
    "skip stage",
    "skip to jobs",
    "jump to jobs",
    "show me jobs",
    "find jobs now",
    "go to final stage",
] as const;

export const JOB_SEARCH_READINESS_FAST_SEARCH_MIN = 55;
export const JOB_SEARCH_READINESS_DEFAULT_MIN = 70;
export const JOB_SEARCH_DEEP_DISCOVERY_DISCOVERY_MIN = 65;

export const GROWTH_POTENTIAL_SCORE_THRESHOLD = 60;
export const GROWTH_POTENTIAL_GOOD_COPY = "Good growth potential based on role trajectory.";
export const GROWTH_POTENTIAL_MODERATE_COPY = "Moderate growth potential. Might require clearer progression steps.";
export const NEXT_STEP_STRENGTHEN_PREFIX = "Strengthen ";
export const NEXT_STEP_STRENGTHEN_SUFFIX = " and then apply.";
export const NEXT_STEP_DEFAULT_APPLY = "Apply and tailor your resume to the highlighted responsibilities.";

export const CYBER_KEYWORDS_FOR_WORK_DIRECTION_FILTERS = [
    "Junior Penetration Tester",
    "Penetration Tester",
    "Cybersecurity",
    "Security Testing",
    "Vulnerability Assessment",
    "Ethical Hacking",
    "Application Security",
] as const;

export const WORK_DIRECTION_QUERY_REGEXES: readonly RegExp[] = [
    /i want to work in\s+(.+)/i,
    /i want a job in\s+(.+)/i,
    /i want to be\s+(.+)/i,
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
