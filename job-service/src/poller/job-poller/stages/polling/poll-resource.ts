export type TheirStackSearchRequest = Record<string, unknown>;
export type TheirStackSearchResponse = Record<string, unknown>;

const THEIRSTACK_JOBS_SEARCH_URL = "https://api.theirstack.com/v1/jobs/search";
const POSTED_AT_MAX_AGE_DAYS = 7;
const JOB_COUNTRY_CODES = ["IL"];
const JOB_SEARCH_LIMIT = 1;

const isTheirStackSearchResponse = (payload: unknown): payload is { data: unknown[] } => {
  if (typeof payload !== "object" || payload === null || !("data" in payload)) {
    return false;
  }

  return Array.isArray(payload.data);
};

export const pollResource = async (): Promise<unknown[]> => {
  const apiKey = process.env.THEIRSTACK_API_KEY;

  if (!apiKey) {
    throw new Error("THEIRSTACK_API_KEY is missing");
  }

  const res = await fetch(THEIRSTACK_JOBS_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      posted_at_max_age_days: POSTED_AT_MAX_AGE_DAYS,
      job_country_code_or: JOB_COUNTRY_CODES,
      limit: JOB_SEARCH_LIMIT
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Resource poll failed: ${res.status} ${res.statusText} - ${errorBody}`,
    );
  }

  const data: unknown = await res.json();
  if (!isTheirStackSearchResponse(data)) {
    throw new Error("Resource poll failed: invalid TheirStack response shape");
  }

  return data.data;
};
