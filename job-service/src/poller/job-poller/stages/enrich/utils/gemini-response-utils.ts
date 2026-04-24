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

export const parseGeminiJson = (raw: string): GeminiExtract | null => {
  const direct = raw.trim();
  try {
    return JSON.parse(direct) as GeminiExtract;
  } catch {
    // ignore and try extracting JSON block
  }

  const start = direct.indexOf("{");
  const end = direct.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = direct.slice(start, end + 1);
    try {
      return JSON.parse(slice) as GeminiExtract;
    } catch {
      return null;
    }
  }
  return null;
};
