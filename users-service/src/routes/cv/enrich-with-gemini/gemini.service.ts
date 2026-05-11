import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AchievementDraft, GeminiAchievementsPayload } from "./gemini.types";

const DEFAULT_GEMINI_MODEL = "gemini-3.0-flash";

const buildPrompt = (input: {
  cvText: string;
  currentJob?: string;
  linkedInUrl?: string;
  githubUrl?: string;
}): string => `
You are an AI career analysis assistant.

Your task is to analyze the user's CV and profile data and extract professional achievements.

Input data:
Current job:
${input.currentJob ?? ""}

LinkedIn URL:
${input.linkedInUrl ?? ""}

GitHub URL:
${input.githubUrl ?? ""}

CV text:
${input.cvText}

Return ONLY valid JSON.
Do not return markdown.
Do not return explanations.

The JSON structure must be:

{
  "achievements": [
    {
      "name": "string in English",
      "grade": number,
      "evidence": "short sentence from the CV that proves this achievement",
      "category": "technical_skill | tool | project | responsibility | measurable_impact | domain_expertise"
    }
  ]
}

Important extraction rules:

- Extract only candidate-owned achievements.
- An achievement is valid only if the CV shows that the candidate personally did, built, designed, developed, maintained, executed, analyzed, improved, reduced, created, led, or implemented it.

- Do NOT create achievements from passive collaboration.
  For example:
  "worked with DevOps teams" is NOT a DevOps achievement.
  It can only support collaboration/teamwork, not DevOps expertise.

- Do NOT create achievements from generic soft skills unless there is measurable evidence.
  For example:
  "conducting code reviews" alone should NOT become a strong achievement.
  It can only be included if the CV says the candidate introduced standards, improved review process, reduced bugs, or led review quality.

- Each achievement must be useful for comparing the candidate against job requirements.
  Prefer achievements that map to:
  1. technical skill
  2. tool/framework
  3. project
  4. responsibility
  5. measurable impact
  6. domain expertise

- Avoid vague achievements such as:
  "Team Collaboration"
  "Working with DevOps"
  "Code Review"
  "Communication"
  "Fast-paced environments"

- Prefer specific achievements such as:
  "Test Automation Framework Development"
  "Performance and Load Testing"
  "Express.js Automation Server Development"
  "Parallelized Test Execution Optimization"
  "Performance Dashboard Creation"
  "Microservices End-to-End Testing"

- Each achievement must include evidence from the CV.
- If the evidence is only collaboration with another team, mark it as supporting evidence only and do not create a skill from it.

Also enforce:
- Do not invent achievements that do not appear in input data.
- grade must be a number between 1 and 100.
- Return at least 3 achievements if possible; otherwise return an empty achievements array.
- achievements must be unique and in English.
- grade should be based on evidence strength and experience signal.
`;

const parseGeminiResponse = (raw: string): GeminiAchievementsPayload | null => {
  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const payload: unknown = JSON.parse(cleaned);
    if (typeof payload !== "object" || payload === null || !("achievements" in payload)) {
      return null;
    }

    return Array.isArray(payload.achievements) ? { achievements: payload.achievements } : null;
  } catch {
    return null;
  }
};

export const extractAchievementsWithGemini = async (input: {
  cvText: string;
  currentJob?: string;
  linkedInUrl?: string;
  githubUrl?: string;
}): Promise<AchievementDraft[]> => {
  const modelName = process.env.GEMINI_MODEL || process.env.LLM_MODEL || DEFAULT_GEMINI_MODEL;
  console.info(`[LLM] CV achievements generator provider=gemini model=${modelName}`);

  try {
    const prompt = buildPrompt(input);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiResponse(responseText);

    if (!parsed || !Array.isArray(parsed.achievements)) {
      console.warn("Gemini returned invalid achievements JSON");
      return [];
    }

    return parsed.achievements
      .filter((achievement) => typeof achievement?.name === "string")
      .map((achievement) => ({
        name: achievement.name.trim(),
        grade: Math.max(1, Math.min(100, Number(achievement.grade) || 1)),
      }))
      .filter((achievement) => achievement.name.length > 0);
  } catch (error) {
    console.error("CV achievements extraction failed", error);
    return [];
  }
};
