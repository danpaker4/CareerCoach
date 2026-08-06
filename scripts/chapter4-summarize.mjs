import { readFileSync, writeFileSync } from "node:fs";

const artifactDirectory = "artifacts/chapter4-experiment-2026-08-05";
const readJson = (name) => JSON.parse(readFileSync(`${artifactDirectory}/${name}`, "utf8").replace(/^\uFEFF/, ""));

const percentile = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
};

const summarizeConversation = (artifact) => {
  const completed = artifact.results.filter((entry) => entry.ok);
  const checks = completed.flatMap((entry) => entry.result.checks);
  const checkNames = [...new Set(checks.map((check) => check.name))].sort();
  const expectedModes = [...new Set(completed.map((entry) => entry.result.expected.mode).filter(Boolean))].sort();
  const durationsMs = completed.map((entry) => entry.result.metadata.durationMs);
  const totalTokens = completed.map((entry) => entry.result.tokenUsage.total);
  const requestCounts = completed.map((entry) => entry.result.tokenUsage.requestCount);

  return {
    requestedRuns: artifact.requestedRuns,
    caseCount: artifact.caseCount,
    attempted: artifact.results.length,
    completed: completed.length,
    transportErrors: artifact.results.length - completed.length,
    passed: completed.filter((entry) => entry.result.passed).length,
    failed: completed.filter((entry) => !entry.result.passed).length,
    passRatePct: completed.length === 0 ? null : completed.filter((entry) => entry.result.passed).length / completed.length * 100,
    checks: Object.fromEntries(checkNames.map((name) => {
      const namedChecks = checks.filter((check) => check.name === name);
      const passed = namedChecks.filter((check) => check.passed).length;
      return [name, { passed, total: namedChecks.length, ratePct: passed / namedChecks.length * 100 }];
    })),
    modes: Object.fromEntries(expectedModes.map((expectedMode) => {
      const entries = completed.filter((entry) => entry.result.expected.mode === expectedMode);
      const correct = entries.filter((entry) => entry.result.mode === expectedMode).length;
      return [expectedMode, {
        cases: entries.length,
        correct,
        accuracyPct: correct / entries.length * 100,
        actualModes: Object.fromEntries([...new Set(entries.map((entry) => entry.result.mode))].sort().map((actualMode) => [
          actualMode,
          entries.filter((entry) => entry.result.mode === actualMode).length,
        ])),
      }];
    })),
    latencyMs: {
      median: percentile(durationsMs, 0.5),
      p95: percentile(durationsMs, 0.95),
      mean: durationsMs.reduce((sum, duration) => sum + duration, 0) / durationsMs.length,
      min: Math.min(...durationsMs),
      max: Math.max(...durationsMs),
    },
    tokens: {
      promptTotal: completed.reduce((sum, entry) => sum + entry.result.tokenUsage.prompt, 0),
      completionTotal: completed.reduce((sum, entry) => sum + entry.result.tokenUsage.completion, 0),
      total: totalTokens.reduce((sum, count) => sum + count, 0),
      medianPerCase: percentile(totalTokens, 0.5),
      meanPerCase: totalTokens.reduce((sum, count) => sum + count, 0) / totalTokens.length,
      requestCount: requestCounts.reduce((sum, count) => sum + count, 0),
    },
    jobsPresented: completed.reduce((sum, entry) => sum + entry.result.jobCount, 0),
    failedCases: completed.filter((entry) => !entry.result.passed).map((entry) => ({
      caseId: entry.caseId,
      expectedMode: entry.result.expected.mode,
      actualMode: entry.result.mode,
      failedChecks: entry.result.checks.filter((check) => !check.passed).map((check) => check.name),
    })),
  };
};

const retrieval = readJson("retrieval-results-v2.json").results;
const semanticRanks = retrieval.map((entry) => entry.semantic.sourceRank);
const keywordRanks = retrieval.map((entry) => entry.keyword.sourceRank);

const summary = {
  generatedAt: new Date().toISOString(),
  localConversation: summarizeConversation(readJson("conversation-local-full.json")),
  cloudConversationIncomplete: summarizeConversation(readJson("conversation-cloud-full.json")),
  retrieval: {
    sampleSize: retrieval.length,
    semantic: {
      hitAt1: semanticRanks.filter((rank) => rank !== null && rank <= 1).length,
      hitAt5: semanticRanks.filter((rank) => rank !== null && rank <= 5).length,
      hitAt10: semanticRanks.filter((rank) => rank !== null && rank <= 10).length,
      meanReciprocalRank: semanticRanks.reduce((sum, rank) => sum + (rank === null ? 0 : 1 / rank), 0) / retrieval.length,
      medianEndpointMs: percentile(retrieval.map((entry) => entry.semantic.wallClockMs), 0.5),
      p95EndpointMs: percentile(retrieval.map((entry) => entry.semantic.wallClockMs), 0.95),
    },
    keyword: {
      hitAt1: keywordRanks.filter((rank) => rank !== null && rank <= 1).length,
      hitAt5: keywordRanks.filter((rank) => rank !== null && rank <= 5).length,
      hitAt10: keywordRanks.filter((rank) => rank !== null && rank <= 10).length,
      meanReciprocalRank: keywordRanks.reduce((sum, rank) => sum + (rank === null ? 0 : 1 / rank), 0) / retrieval.length,
      medianEndpointMs: percentile(retrieval.map((entry) => entry.keyword.wallClockMs), 0.5),
      p95EndpointMs: percentile(retrieval.map((entry) => entry.keyword.wallClockMs), 0.95),
    },
  },
};

writeFileSync(`${artifactDirectory}/summary.json`, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
