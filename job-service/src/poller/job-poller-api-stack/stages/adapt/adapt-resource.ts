import type { AdaptedJob } from "./adapt-resource.types";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const readRequiredString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const readNullableNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toAdaptedJob = (value: unknown): AdaptedJob | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const id = readRequiredString(record, "id");
  const jobTitle = readRequiredString(record, "job_title");
  const url = readRequiredString(record, "final_url");
  const company = readRequiredString(record, "company");
  const seniority = readRequiredString(record, "seniority");
  const description = readRequiredString(record, "description");

  if (!id || !jobTitle || !url || !company || !seniority || !description) {
    return null;
  }

  return {
    id,
    jobTitle,
    url,
    company,
    seniority,
    description,
    lon: readNullableNumber(record, "longitude"),
    lat: readNullableNumber(record, "latitude"),
  };
};

export const adaptResource = (resource: readonly unknown[]): AdaptedJob[] =>
  resource.map(toAdaptedJob).filter((job): job is AdaptedJob => job !== null);
