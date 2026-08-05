import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdaptedJob } from "../../adapt/adapt-resource.types";
import { enrichByGemini } from "../enrich-by-gemini";

const createJob = (): AdaptedJob => ({
  id: "job-1",
  jobTitle: "Software Engineer",
  url: "https://example.test/jobs/1",
  company: "Example",
  seniority: "mid",
  description: "Build TypeScript services.",
  lon: null,
  lat: null,
});

const stubOllamaResponse = (response: string): void => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ response }), { status: 200 })),
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("enrichByGemini", () => {
  it("keeps extracted fields when Ollama returns a null salary", async () => {
    vi.stubEnv("LLM_PROVIDER", "ollama");
    vi.stubEnv("LLM_MODEL", "llama3");
    vi.stubEnv("GEMINI_API_KEY", "");
    stubOllamaResponse(`Here is the extracted data:\n${JSON.stringify({
      salary: null,
      requirements: [],
      benefits: ["Remote work"],
      languages: ["TypeScript"],
      frameworks: [],
      databases: [],
      platforms: [],
      tools: ["Terraform"],
      mustKnowSkills: ["TypeScript"],
      niceToHaveSkills: [],
    })}`);

    const [job] = await enrichByGemini([createJob()]);

    expect(job).toMatchObject({
      salary: 100,
      requirements: [],
      benefits: ["Remote work"],
      languages: ["TypeScript"],
      tools: ["Terraform"],
    });
  });

  it("does not invent requirements when enrichment falls back", async () => {
    vi.stubEnv("LLM_PROVIDER", "ollama");
    vi.stubEnv("LLM_MODEL", "llama3");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("Ollama unavailable"))));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const [job] = await enrichByGemini([createJob()]);

    expect(job?.requirements).toEqual([]);
  });
});
