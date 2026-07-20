import { describe, it, expect, vi } from "vitest";
import type { Collection } from "mongodb";
import { rankJobsByCosine, semanticSearchJobs } from "../semantic-search";
import type { EnrichedJob } from "../../../poller/job-poller-api-stack/stages/enrich/types";

const makeJob = (id: string, searchEmbedding: number[]): EnrichedJob =>
  ({ id, jobTitle: id, searchEmbedding } as unknown as EnrichedJob);

describe("rankJobsByCosine", () => {
  it("ranks the most semantically similar job first", () => {
    const query = [1, 0];
    const jobs = [
      makeJob("orthogonal", [0, 1]), // cosine 0
      makeJob("identical", [1, 0]), // cosine 1
      makeJob("diagonal", [0.7, 0.7]), // cosine ~0.707
    ];

    const ranked = rankJobsByCosine(query, jobs, 10);

    expect(ranked.map((j) => j.id)).toEqual(["identical", "diagonal", "orthogonal"]);
  });

  it("respects the limit", () => {
    const query = [1, 0];
    const jobs = [
      makeJob("a", [1, 0]),
      makeJob("b", [0.9, 0.1]),
      makeJob("c", [0.8, 0.2]),
    ];

    expect(rankJobsByCosine(query, jobs, 2)).toHaveLength(2);
  });

  it("skips jobs whose embedding dimensionality differs from the query", () => {
    const query = [1, 0, 0];
    const jobs = [
      makeJob("wrong-dim", [1, 0]), // 2-d, must be ignored
      makeJob("right-dim", [1, 0, 0]),
    ];

    const ranked = rankJobsByCosine(query, jobs, 10);

    expect(ranked.map((j) => j.id)).toEqual(["right-dim"]);
  });

  it("skips jobs with missing or empty embeddings", () => {
    const query = [1, 0];
    const jobs = [
      makeJob("empty", []),
      makeJob("good", [1, 0]),
      { id: "missing", jobTitle: "missing" } as unknown as EnrichedJob,
    ];

    const ranked = rankJobsByCosine(query, jobs, 10);

    expect(ranked.map((j) => j.id)).toEqual(["good"]);
  });

  it("drops matches below minSimilarity when a threshold is given", () => {
    const query = [1, 0];
    const jobs = [
      makeJob("strong", [1, 0]), // cosine 1
      makeJob("weak", [0, 1]), // cosine 0
    ];

    const ranked = rankJobsByCosine(query, jobs, 10, 0.5);

    expect(ranked.map((j) => j.id)).toEqual(["strong"]);
  });

  it("returns an empty array for an empty query vector", () => {
    expect(rankJobsByCosine([], [makeJob("a", [1, 0])], 10)).toEqual([]);
  });
});

describe("semanticSearchJobs", () => {
  it("ranks lightweight candidates then hydrates the top docs in rank order", async () => {
    const candidates = [
      { id: "a", searchEmbedding: [1, 0] }, // cosine 1
      { id: "b", searchEmbedding: [0, 1] }, // cosine 0
      { id: "c", searchEmbedding: [0.9, 0.1] }, // cosine ~0.994
    ];
    // DB returns the hydrated docs in a DIFFERENT order than the ranking.
    const hydrated = [
      { id: "c", jobTitle: "C", searchEmbedding: [0.9, 0.1] },
      { id: "a", jobTitle: "A", searchEmbedding: [1, 0] },
    ];

    const limit = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(candidates) });
    const find = vi
      .fn()
      .mockReturnValueOnce({ limit }) // candidate fetch (projection + limit)
      .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue(hydrated) }); // hydrate top ids
    const collection = { find } as unknown as Collection<EnrichedJob>;

    const result = await semanticSearchJobs(collection, [1, 0], 2);

    // top 2 by query relevance are a (1.0) and c (~0.994), in that order,
    // regardless of the order the hydrate query returned them.
    expect(result.map((j) => j.id)).toEqual(["a", "c"]);
    // second find is the $in hydrate for exactly the ranked top ids
    expect(find).toHaveBeenCalledTimes(2);
    expect(find).toHaveBeenLastCalledWith({ id: { $in: ["a", "c"] } });
  });

  it("returns [] (no semantic results) when no jobs have embeddings", async () => {
    const limit = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
    const find = vi.fn().mockReturnValue({ limit });
    const collection = { find } as unknown as Collection<EnrichedJob>;

    expect(await semanticSearchJobs(collection, [1, 0], 10)).toEqual([]);
    expect(find).toHaveBeenCalledTimes(1); // no hydrate query when there are no candidates
  });
});
