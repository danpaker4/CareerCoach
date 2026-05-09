import type { GeminiExtract } from "../types";

export const cleanStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const isGeminiExtract = (payload: unknown): payload is GeminiExtract => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const salaryIsValid = !("salary" in payload) || typeof payload.salary === "number";
  const requirementsAreValid = !("requirements" in payload) || Array.isArray(payload.requirements);
  const benefitsAreValid = !("benefits" in payload) || Array.isArray(payload.benefits);
  const languagesAreValid = !("languages" in payload) || Array.isArray(payload.languages);
  const frameworksAreValid = !("frameworks" in payload) || Array.isArray(payload.frameworks);
  const databasesAreValid = !("databases" in payload) || Array.isArray(payload.databases);
  const platformsAreValid = !("platforms" in payload) || Array.isArray(payload.platforms);
  const toolsAreValid = !("tools" in payload) || Array.isArray(payload.tools);
  const mustKnowSkillsAreValid = !("mustKnowSkills" in payload) || Array.isArray(payload.mustKnowSkills);
  const niceToHaveSkillsAreValid = !("niceToHaveSkills" in payload) || Array.isArray(payload.niceToHaveSkills);
  return salaryIsValid
    && requirementsAreValid
    && benefitsAreValid
    && languagesAreValid
    && frameworksAreValid
    && databasesAreValid
    && platformsAreValid
    && toolsAreValid
    && mustKnowSkillsAreValid
    && niceToHaveSkillsAreValid;
};

const parseJsonObject = (raw: string): GeminiExtract | null => {
  const payload: unknown = JSON.parse(raw);
  return isGeminiExtract(payload) ? payload : null;
};

export const parseGeminiJson = (raw: string): GeminiExtract | null => {
  const direct = raw.trim();
  try {
    return parseJsonObject(direct);
  } catch {
    // ignore and try extracting JSON block
  }

  const start = direct.indexOf("{");
  const end = direct.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = direct.slice(start, end + 1);
    try {
      return parseJsonObject(slice);
    } catch {
      return null;
    }
  }
  return null;
};
