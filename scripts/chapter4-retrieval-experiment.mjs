import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const readArgument = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
};

const samplePath = readArgument("sample");
const outputPath = readArgument("output");
const semanticUrl = readArgument("semantic-url");
const keywordUrl = readArgument("keyword-url");

if (!samplePath || !outputPath || !semanticUrl || !keywordUrl) {
  throw new Error("Usage: node scripts/chapter4-retrieval-experiment.mjs --sample=PATH --output=PATH --semantic-url=URL --keyword-url=URL");
}

const sample = JSON.parse(readFileSync(samplePath, "utf8").replace(/^\uFEFF/, ""));
const results = [];
const artifact = {
  protocolVersion: 1,
  definition: "Source-document recovery from the first three stored requirements of each sampled job",
  samplePath,
  semanticUrl,
  keywordUrl,
  startedAt: new Date().toISOString(),
  completedAt: null,
  results,
};

const saveArtifact = () => writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

const runSearch = async (url, payload) => {
  const start = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return {
    wallClockMs: Math.round(performance.now() - start),
    jobs: JSON.parse(text),
  };
};

saveArtifact();

for (const sourceJob of sample) {
  const sourceId = String(sourceJob.id);
  const queryRequirements = sourceJob.requirements.slice(0, 3);
  const payload = {
    skills: queryRequirements,
    interests: [],
    experienceLevel: sourceJob.seniority ?? "",
    keywords: [],
  };
  const semantic = await runSearch(semanticUrl, payload);
  const keyword = await runSearch(keywordUrl, payload);
  const semanticIds = semantic.jobs.map((job) => String(job.jobId));
  const keywordIds = keyword.jobs.map((job) => String(job.jobId));
  results.push({
    sourceId,
    sourceTitle: sourceJob.jobTitle,
    queryRequirements,
    semantic: {
      wallClockMs: semantic.wallClockMs,
      resultCount: semanticIds.length,
      sourceRank: semanticIds.indexOf(sourceId) + 1 || null,
      resultIds: semanticIds,
    },
    keyword: {
      wallClockMs: keyword.wallClockMs,
      resultCount: keywordIds.length,
      sourceRank: keywordIds.indexOf(sourceId) + 1 || null,
      resultIds: keywordIds,
    },
  });
  saveArtifact();
  console.log(`${sourceId}: semantic rank=${results.at(-1).semantic.sourceRank ?? "miss"}; keyword rank=${results.at(-1).keyword.sourceRank ?? "miss"}`);
}

artifact.completedAt = new Date().toISOString();
saveArtifact();
