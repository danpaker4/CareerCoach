export type TheirStackSearchRequest = Record<string, unknown>;
export type TheirStackSearchResponse = Record<string, unknown>;

const THEIRSTACK_JOBS_SEARCH_URL = "https://api.theirstack.com/v1/jobs/search";

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
      posted_at_max_age_days: 7,
      job_country_code_or: ["IL"],
      limit: 1
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Resource poll failed: ${res.status} ${res.statusText} - ${errorBody}`,
    );
  }

  const data = await res.json() as { data: unknown[] };
  console.log(data);
  return data.data as unknown[];
}
