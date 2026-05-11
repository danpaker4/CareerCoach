import type { AdaptedJob } from "../../adapt/adapt-resource.types";
import type { EnrichedJob } from "../types";

const detectKnownTerms = (description: string, map: Record<string, string>): string[] => {
  const normalized = description.toLowerCase();
  const found = new Set<string>();
  for (const [needle, canonical] of Object.entries(map)) {
    if (normalized.includes(needle)) {
      found.add(canonical);
    }
  }
  return [...found];
};

export const inferFallback = (job: AdaptedJob): Pick<EnrichedJob, "salary" | "requirements" | "benefits" | "languages" | "frameworks" | "databases" | "platforms" | "tools" | "mustKnowSkills" | "niceToHaveSkills"> => {
  const seniorityHint = job.seniority.toLowerCase();
  const seniorityLevel = seniorityHint.includes("senior")
    ? "senior"
    : seniorityHint.includes("junior")
      ? "junior"
      : "mid";

  const languages = detectKnownTerms(job.description, {
    typescript: "TypeScript",
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
    go: "Go",
  });
  const frameworks = detectKnownTerms(job.description, {
    react: "React",
    angular: "Angular",
    vue: "Vue",
    express: "Express",
    nest: "NestJS",
  });
  const databases = detectKnownTerms(job.description, {
    mongodb: "MongoDB",
    mongo: "MongoDB",
    postgres: "PostgreSQL",
    mysql: "MySQL",
    redis: "Redis",
  });
  const platforms = detectKnownTerms(job.description, {
    aws: "AWS",
    azure: "Azure",
    gcp: "GCP",
    kubernetes: "Kubernetes",
    docker: "Docker",
  });
  const tools = detectKnownTerms(job.description, {
    kafka: "Kafka",
    cypress: "Cypress",
    playwright: "Playwright",
    jira: "Jira",
    git: "Git",
  });
  const mustKnowSkills = [...new Set([...languages, ...frameworks, ...databases, ...platforms])];

  return {
    salary: 100,
    requirements: [
      `${seniorityLevel} level experience relevant to ${job.jobTitle}`,
      "Strong communication and collaboration skills",
      "Ability to deliver features in production environments",
    ],
    benefits: [
      "Health and wellness package",
      "Paid time off",
      "Learning and growth opportunities",
    ],
    languages,
    frameworks,
    databases,
    platforms,
    tools,
    mustKnowSkills,
    niceToHaveSkills: [],
  };
};
