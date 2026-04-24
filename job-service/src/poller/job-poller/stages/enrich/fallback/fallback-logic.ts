import type { AdaptedJob } from "../../adapt/adapt-resource.types";
import type { EnrichedJob } from "../types";

export const inferFallback = (job: AdaptedJob): Pick<EnrichedJob, "salary" | "requirements" | "benefits"> => {
  const seniorityHint = job.seniority.toLowerCase();
  const seniorityLevel = seniorityHint.includes("senior")
    ? "senior"
    : seniorityHint.includes("junior")
      ? "junior"
      : "mid";

  return {
    salary: 100 as number,
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
  };
};
