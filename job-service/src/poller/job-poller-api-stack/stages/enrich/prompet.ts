import type { AdaptedJob } from "../adapt/adapt-resource.types";

export const buildEnrichmentPrompt = (job: AdaptedJob): string => `
You are extracting structured data from a job description.
Return ONLY valid JSON with this exact shape:
{
  "salary": "number",
  "requirements": ["string"],
  "benefits": ["string"],
  "languages": ["string"],
  "frameworks": ["string"],
  "databases": ["string"],
  "platforms": ["string"],
  "tools": ["string"],
  "mustKnowSkills": ["string"],
  "niceToHaveSkills": ["string"]
}

Rules:
- salary must be numeric and represent dollars per hour.
- Extract only values grounded in the job text. Do not invent technologies or benefits not implied by the description.
- If a field is missing, return an empty array for that field.
- Keep requirements and benefits short bullet-style phrases.
- Use canonical skill names when possible (Node.js, MongoDB, TypeScript, AWS, Docker, Kubernetes).
- All returned values must be in English.

Job:
- Title: ${job.jobTitle}
- Company: ${job.company}
- Seniority: ${job.seniority}
- Description:
${job.description}
`;
