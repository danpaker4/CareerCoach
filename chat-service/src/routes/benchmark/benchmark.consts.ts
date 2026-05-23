import { DEFAULT_GEMINI_MODEL, DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL } from "../../ai/llm-config.consts";
import type { JobSearchResultItem } from "../chat/chat.types";
import type { BenchmarkCase } from "./benchmark.types";

export const BENCHMARK_ROUTE_PREFIX = "/api/chat/benchmarks";
export const BENCHMARK_DEFAULT_RUN_LIMIT = 10;
export const BENCHMARK_MAX_RUN_LIMIT = 50;
export const BENCHMARK_USER_ID_PREFIX = "benchmark-user";
export const BENCHMARK_RANDOM_CASE_COUNT = 3;
export const BENCHMARK_OLLAMA_MODEL_FALLBACK = DEFAULT_OLLAMA_MODEL;
export const BENCHMARK_OLLAMA_BASE_URL_FALLBACK = DEFAULT_OLLAMA_BASE_URL;
export const BENCHMARK_GEMINI_MODEL_FALLBACK = DEFAULT_GEMINI_MODEL;

export const BENCHMARK_RUBRIC = [
    {
        label: "Response coverage",
        weight: 33,
        description: "Non-empty replies that cover the latest user request, include broad required terms, and avoid internal leaks.",
    },
    {
        label: "Latency",
        weight: 33,
        description: "Faster successful responses score higher relative to the fastest model for the same case.",
    },
    {
        label: "Token efficiency",
        weight: 34,
        description: "Lower-token successful responses score higher relative to the most efficient model for the same case.",
    },
] as const;

const benchmarkJobs: readonly JobSearchResultItem[] = [
    {
        id: "fixture-backend-node",
        title: "Backend Engineer",
        company: "Northstar Apps",
        url: "https://example.test/jobs/backend-node",
        seniority: "Junior-Mid",
        description: "Build Node.js APIs, optimize MongoDB queries, and work with event-driven services using queues.",
        salary: 14500,
        requirements: ["Node.js", "TypeScript", "MongoDB", "REST APIs"],
        mustKnowSkills: ["Node.js", "TypeScript"],
        niceToHaveSkills: ["MongoDB", "RabbitMQ", "Docker"],
        benefits: ["Mentorship", "Hybrid schedule"],
        location: "Tel Aviv",
    },
    {
        id: "fixture-security-qa",
        title: "Security QA Automation Engineer",
        company: "ShieldPath",
        url: "https://example.test/jobs/security-qa",
        seniority: "Junior",
        description: "Use automation, API testing, and security testing basics to validate web applications and CI pipelines.",
        salary: 13200,
        requirements: ["QA automation", "API testing", "JavaScript", "Security testing basics"],
        mustKnowSkills: ["Automation", "API testing"],
        niceToHaveSkills: ["OWASP", "CI/CD", "Node.js"],
        benefits: ["Security training", "Certification budget"],
        location: "Remote",
    },
    {
        id: "fixture-soc-analyst",
        title: "Junior SOC Analyst",
        company: "BlueSignal Security",
        url: "https://example.test/jobs/soc-analyst",
        seniority: "Junior",
        description: "Monitor alerts, triage incidents, document findings, and learn cloud security tooling.",
        salary: 11800,
        requirements: ["Networking basics", "Security monitoring", "Incident response"],
        mustKnowSkills: ["Security fundamentals"],
        niceToHaveSkills: ["Python", "Linux", "SIEM"],
        benefits: ["Shift flexibility", "Mentorship"],
        location: "Haifa",
    },
];

export const BENCHMARK_CASES: readonly BenchmarkCase[] = [
    {
        id: "unclear-direction-discovery",
        title: "Unclear Direction Discovery",
        description: "Junior full-stack developer feels stuck and needs direction without naming a target role.",
        messages: [
            "Hi, I am a junior full stack developer with around 2 years of experience. I feel stuck and I don't know what skills I should focus on next.",
            "Mostly Angular, Node.js, TypeScript, MongoDB, and some RabbitMQ. I like backend work and solving performance problems.",
        ],
        profile: {
            firstName: "Dana",
            lastName: "Benchmark",
            currentJob: "Junior full-stack developer",
            technologies: ["Angular", "Node.js", "TypeScript", "MongoDB", "RabbitMQ"],
            interests: ["backend", "performance", "architecture"],
        },
        achievements: [
            { id: "ach-api", name: "Built production Node.js APIs with MongoDB", grade: 82 },
            { id: "ach-ui", name: "Delivered Angular features for internal dashboards", grade: 74 },
        ],
        roleExperience: [{
            roleKey: "fullstack",
            displayLabel: "Full-stack Developer",
            level: "junior",
            years: 2,
            evidence: ["Benchmark fixture"],
            source: "cv",
            updatedAt: new Date(0),
        }],
        jobs: benchmarkJobs,
        assertions: {
            forbiddenPhrases: ["remote/hybrid/on-site", "internal achievement", "job id"],
            forbiddenJobIds: benchmarkJobs.map((job) => job.id),
            requiredReplyTerms: ["backend"],
        },
    },
    {
        id: "cybersecurity-domain-exploration",
        title: "Cybersecurity Domain Exploration",
        description: "QA automation user asks which cybersecurity directions fit their background.",
        messages: [
            "I work in QA automation with JavaScript and API testing. What can I do in cybersecurity?",
        ],
        profile: {
            firstName: "Dana",
            lastName: "Benchmark",
            currentJob: "QA automation engineer",
            technologies: ["JavaScript", "API testing", "Cypress", "Node.js"],
            interests: ["automation", "security", "debugging"],
        },
        achievements: [{ id: "ach-qa", name: "Automated API regression tests in CI", grade: 86 }],
        roleExperience: [{
            roleKey: "qa",
            displayLabel: "QA Automation Engineer",
            level: "mid",
            years: 3,
            evidence: ["Benchmark fixture"],
            source: "cv",
            updatedAt: new Date(0),
        }],
        jobs: benchmarkJobs,
        assertions: {
            forbiddenPhrases: ["remote/hybrid/on-site", "job id"],
            forbiddenJobIds: benchmarkJobs.map((job) => job.id),
            requiredReplyTerms: ["security"],
        },
    },
    {
        id: "direct-backend-job-search",
        title: "Direct Backend Job Search",
        description: "Backend-oriented user directly asks for matching roles.",
        messages: [
            "Find me backend roles that fit Node.js, TypeScript, MongoDB, and RabbitMQ.",
        ],
        profile: {
            firstName: "Dana",
            lastName: "Benchmark",
            currentJob: "Junior full-stack developer",
            technologies: ["Node.js", "TypeScript", "MongoDB", "RabbitMQ"],
            interests: ["backend", "distributed systems"],
        },
        achievements: [{ id: "ach-node", name: "Built queue-backed Node.js services", grade: 88 }],
        roleExperience: [{
            roleKey: "backend",
            displayLabel: "Backend Developer",
            level: "junior",
            years: 2,
            evidence: ["Benchmark fixture"],
            source: "cv",
            updatedAt: new Date(0),
        }],
        jobs: benchmarkJobs,
        assertions: {
            forbiddenPhrases: ["remote/hybrid/on-site", "job id"],
            forbiddenJobIds: benchmarkJobs.map((job) => job.id),
            requiredReplyTerms: ["backend"],
        },
    },
    {
        id: "follow-up-grounding",
        title: "Follow-up Grounding",
        description: "User asks for salary/company details after a recommendation and should receive fixture-only facts.",
        messages: [
            "Find me cybersecurity roles that fit my QA automation background.",
            "What is the company and salary for that job?",
        ],
        profile: {
            firstName: "Dana",
            lastName: "Benchmark",
            currentJob: "QA automation engineer",
            technologies: ["JavaScript", "API testing", "Cypress"],
            interests: ["security", "automation"],
        },
        achievements: [{ id: "ach-security-qa", name: "Created API test coverage for auth and permission flows", grade: 84 }],
        roleExperience: [{
            roleKey: "qa",
            displayLabel: "QA Automation Engineer",
            level: "mid",
            years: 3,
            evidence: ["Benchmark fixture"],
            source: "cv",
            updatedAt: new Date(0),
        }],
        jobs: benchmarkJobs,
        assertions: {
            forbiddenPhrases: ["remote/hybrid/on-site", "job id"],
            forbiddenJobIds: benchmarkJobs.map((job) => job.id),
            requiredReplyTerms: ["ShieldPath"],
            fixtureOnlyTerms: ["ShieldPath", "13200"],
        },
    },
    {
        id: "soc-analyst-job-search",
        title: "SOC Analyst Job Search",
        description: "Security-focused junior user directly asks for SOC roles.",
        messages: [
            "I know networking basics, Linux, and some Python. Find me junior SOC analyst roles that fit.",
        ],
        profile: {
            firstName: "Dana",
            lastName: "Benchmark",
            currentJob: "IT support specialist",
            technologies: ["Networking basics", "Linux", "Python", "Security fundamentals"],
            interests: ["security monitoring", "incident response", "cloud security"],
        },
        achievements: [{ id: "ach-alerts", name: "Documented and escalated production support incidents", grade: 79 }],
        roleExperience: [{
            roleKey: "it-support",
            displayLabel: "IT Support Specialist",
            level: "junior",
            years: 1,
            evidence: ["Benchmark fixture"],
            source: "cv",
            updatedAt: new Date(0),
        }],
        jobs: benchmarkJobs,
        assertions: {
            forbiddenPhrases: ["remote/hybrid/on-site", "job id"],
            forbiddenJobIds: benchmarkJobs.map((job) => job.id),
            requiredReplyTerms: ["SOC"],
        },
    },
    {
        id: "backend-salary-follow-up",
        title: "Backend Salary Follow-up",
        description: "Backend match followed by a company and salary question should stay grounded in fixture data.",
        messages: [
            "Find me backend roles for Node.js, TypeScript, MongoDB, and REST APIs.",
            "What company is that role at, and what salary did you find?",
        ],
        profile: {
            firstName: "Dana",
            lastName: "Benchmark",
            currentJob: "Junior backend developer",
            technologies: ["Node.js", "TypeScript", "MongoDB", "REST APIs"],
            interests: ["backend", "API design", "performance"],
        },
        achievements: [{ id: "ach-rest", name: "Improved REST API response times with MongoDB indexes", grade: 90 }],
        roleExperience: [{
            roleKey: "backend",
            displayLabel: "Backend Developer",
            level: "junior",
            years: 2,
            evidence: ["Benchmark fixture"],
            source: "cv",
            updatedAt: new Date(0),
        }],
        jobs: benchmarkJobs,
        assertions: {
            forbiddenPhrases: ["remote/hybrid/on-site", "job id"],
            forbiddenJobIds: benchmarkJobs.map((job) => job.id),
            requiredReplyTerms: ["Northstar Apps"],
            fixtureOnlyTerms: ["Northstar Apps", "14500"],
        },
    },
    {
        id: "premature-search-avoidance",
        title: "Premature Search Avoidance",
        description: "User asks for direction between backend and cybersecurity without asking for job listings.",
        messages: [
            "I am torn between backend development and cybersecurity. Help me decide which direction fits me better before looking at jobs.",
        ],
        profile: {
            firstName: "Dana",
            lastName: "Benchmark",
            currentJob: "Junior full-stack developer",
            technologies: ["Angular", "Node.js", "TypeScript", "MongoDB", "JavaScript"],
            interests: ["backend", "security", "debugging"],
        },
        achievements: [
            { id: "ach-debug", name: "Debugged production API issues across frontend and backend", grade: 81 },
            { id: "ach-tests", name: "Added API tests for authentication edge cases", grade: 78 },
        ],
        roleExperience: [{
            roleKey: "fullstack",
            displayLabel: "Full-stack Developer",
            level: "junior",
            years: 2,
            evidence: ["Benchmark fixture"],
            source: "cv",
            updatedAt: new Date(0),
        }],
        jobs: benchmarkJobs,
        assertions: {
            forbiddenPhrases: ["remote/hybrid/on-site", "job id"],
            forbiddenJobIds: benchmarkJobs.map((job) => job.id),
            requiredReplyTerms: ["backend"],
        },
    },
    {
        id: "compare-qa-automation-options",
        title: "Compare QA Automation Options",
        description: "QA automation user asks for matching role options and should get the strongest fixture recommendation.",
        messages: [
            "Compare roles that fit QA automation, API testing, JavaScript, and CI work. Recommend the best fit.",
        ],
        profile: {
            firstName: "Dana",
            lastName: "Benchmark",
            currentJob: "QA automation engineer",
            technologies: ["JavaScript", "API testing", "Cypress", "CI/CD", "Node.js"],
            interests: ["security", "automation", "web application testing"],
        },
        achievements: [{ id: "ach-ci-security", name: "Added automated API checks to CI for auth regressions", grade: 87 }],
        roleExperience: [{
            roleKey: "qa",
            displayLabel: "QA Automation Engineer",
            level: "mid",
            years: 3,
            evidence: ["Benchmark fixture"],
            source: "cv",
            updatedAt: new Date(0),
        }],
        jobs: benchmarkJobs,
        assertions: {
            forbiddenPhrases: ["remote/hybrid/on-site", "job id"],
            forbiddenJobIds: benchmarkJobs.map((job) => job.id),
            requiredReplyTerms: ["QA"],
        },
    },
] as const;
