import type { AdaptedJob } from "../adapt/adapt-resource.types";

export const buildEnrichmentPrompt = (job: AdaptedJob): string => `
You are extracting structured data from a job description.
Return ONLY valid JSON with this exact shape:
{
  "salary": "number",
  "requirements": ["string"],
  "benefits": ["string"]
}

Rules:
- salary must be in the format of a number. must be as doller per hour
- If salary/requirements/benefits are explicitly written, use them.
- If any value is missing, infer a realistic value from the role title, company and seniority.
- Keep requirements and benefits short bullet-style phrases.
- All returned values must be in English.

Job:
- Title: ${job.jobTitle}
- Company: ${job.company}
- Seniority: ${job.seniority}
- Description:
${job.description}
`;
