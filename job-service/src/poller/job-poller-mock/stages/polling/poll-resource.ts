import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MOCK_JOBS_COUNT = 8;
const GEMINI_MODEL = process.env.LLM_MODEL || "gemini-2.5-flash-lite";

export type MockGeneratedJob = {
  id: string;
  jobTitle: string;
  url: string;
  company: string;
  seniority: string;
  description: string;
  lon: number | null;
  lat: number | null;
  salary: number;
  requirements: string[];
  benefits: string[];
  searchableText: string;
};

type MockPollResponse = {
  data: MockGeneratedJob[];
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isMockGeneratedJob = (value: unknown): value is MockGeneratedJob => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const hasRequiredStrings =
    typeof record.id === "string" &&
    typeof record.jobTitle === "string" &&
    typeof record.url === "string" &&
    typeof record.company === "string" &&
    typeof record.seniority === "string" &&
    typeof record.description === "string" &&
    typeof record.searchableText === "string";
  const hasValidCoordinates =
    (typeof record.lon === "number" || record.lon === null) &&
    (typeof record.lat === "number" || record.lat === null);
  const hasValidArrays = isStringArray(record.requirements) && isStringArray(record.benefits);
  const hasValidSalary = typeof record.salary === "number" && Number.isFinite(record.salary);

  return hasRequiredStrings && hasValidCoordinates && hasValidArrays && hasValidSalary;
};

const parseMockPollResponse = (raw: string): MockPollResponse => {
  const normalized = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBraceIndex = normalized.indexOf("{");
  const lastBraceIndex = normalized.lastIndexOf("}");
  const jsonText = firstBraceIndex >= 0 && lastBraceIndex >= firstBraceIndex
    ? normalized.slice(firstBraceIndex, lastBraceIndex + 1)
    : normalized;
  const parsed: unknown = JSON.parse(jsonText);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Mock poller returned non-object payload");
  }

  const payload = parsed as Record<string, unknown>;
  const data = payload.data;
  if (!Array.isArray(data)) {
    throw new Error("Mock poller payload must include data array");
  }

  const validJobs = data.filter(isMockGeneratedJob);
  return { data: validJobs };
};

const buildMockJobsPrompt = (jobsCount: number): string => `
Generate realistic software jobs in Israel and respond ONLY with valid JSON.
The JSON must be Mongo-ready for storage:
{
  "data": [
    {
      "id": "string",
      "jobTitle": "string",
      "url": "https://example.com/jobs/123",
      "company": "string",
      "seniority": "Junior|Mid|Senior|Lead",
      "description": "string",
      "lon": number|null,
      "lat": number|null,
      "salary": number,
      "requirements": ["string"],
      "benefits": ["string"],
      "searchableText": "string"
    }
  ]
}

Rules:
- Return exactly ${jobsCount} jobs.
- Keep descriptions detailed (at least 50 words).
- Use valid unique ids and unique URLs.
- Keep all fields present for every job and make salary realistic.
- searchableText must combine title, description, requirements, and benefits into one plain text field.
- Do not add extra fields.
`;

export const pollResource = async (): Promise<MockGeneratedJob[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const requestedCount = Number(process.env.MOCK_JOBS_COUNT || DEFAULT_MOCK_JOBS_COUNT);
  const jobsCount = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : DEFAULT_MOCK_JOBS_COUNT;
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(buildMockJobsPrompt(jobsCount));
  const rawText = result.response.text();
  const parsed = parseMockPollResponse(rawText);

  return parsed.data;
};
