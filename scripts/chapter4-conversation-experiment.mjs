import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const readArgument = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
};

const baseUrl = readArgument("base-url");
const modelLabel = readArgument("model");
const outputPath = readArgument("output");
const runCount = Number(readArgument("runs") ?? "1");
const requestsPerMinute = Number(readArgument("requests-per-minute") ?? "0");
const initialDelayMs = Number(readArgument("initial-delay-ms") ?? "0");
const selectedCaseIds = new Set((readArgument("case-ids") ?? "").split(",").filter(Boolean));

if (!baseUrl || !modelLabel || !outputPath || !Number.isInteger(runCount) || runCount < 1) {
  throw new Error("Usage: node scripts/chapter4-conversation-experiment.mjs --base-url=URL --model=LABEL --runs=N --output=PATH");
}

const fetchJson = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(600_000),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return body;
};

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
const quotaWindowMs = 65_000;
const requestEvents = [];

const waitForQuotaBudget = async (requestCount) => {
  if (requestsPerMinute <= 0) {
    return;
  }
  const now = Date.now();
  const expiredEventCount = requestEvents.findIndex((timestamp) => timestamp > now - quotaWindowMs);
  const deleteCount = expiredEventCount === -1 ? requestEvents.length : expiredEventCount;
  requestEvents.splice(0, deleteCount);
  if (requestEvents.length + requestCount <= requestsPerMinute) {
    return;
  }
  const waitMs = Math.max(1_000, requestEvents[0] + quotaWindowMs - now);
  console.log(`[${modelLabel}] waiting ${Math.ceil(waitMs / 1_000)} seconds for provider quota`);
  await sleep(waitMs);
  await waitForQuotaBudget(requestCount);
};

const saveArtifact = (artifact) => {
  const absoluteOutputPath = resolve(outputPath);
  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
};

const cases = (await fetchJson(`${baseUrl}/evaluation-cases`))
  .filter((evaluationCase) => /^eval-\d{2}-/.test(evaluationCase.id))
  .filter((evaluationCase) => selectedCaseIds.size === 0 || selectedCaseIds.has(evaluationCase.id))
  .sort((left, right) => left.id.localeCompare(right.id));

const startedAt = new Date().toISOString();
const results = [];
const artifact = {
  protocolVersion: 1,
  modelLabel,
  baseUrl,
  startedAt,
  completedAt: null,
  requestedRuns: runCount,
  caseCount: cases.length,
  results,
};

saveArtifact(artifact);

if (initialDelayMs > 0) {
  console.log(`[${modelLabel}] initial quota-cooldown wait: ${Math.ceil(initialDelayMs / 1_000)} seconds`);
  await sleep(initialDelayMs);
}

for (const runNumber of Array.from({ length: runCount }, (_, index) => index + 1)) {
  for (const evaluationCase of cases) {
    const userTurnCount = evaluationCase.messages.filter((message) => message.role === "user").length;
    await waitForQuotaBudget(userTurnCount);
    const caseStartedAt = new Date().toISOString();
    const start = performance.now();
    try {
      const result = await fetchJson(`${baseUrl}/evaluation-cases/${evaluationCase.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const wallClockMs = Math.round(performance.now() - start);
      results.push({ runNumber, caseId: evaluationCase.id, caseStartedAt, wallClockMs, ok: true, result });
      console.log(`[${modelLabel}] run ${runNumber}/${runCount} ${evaluationCase.id}: ${result.passed ? "PASS" : "FAIL"} (${wallClockMs} ms)`);
    } catch (error) {
      const wallClockMs = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : String(error);
      results.push({ runNumber, caseId: evaluationCase.id, caseStartedAt, wallClockMs, ok: false, error: message });
      console.error(`[${modelLabel}] run ${runNumber}/${runCount} ${evaluationCase.id}: ERROR (${wallClockMs} ms): ${message}`);
    }
    requestEvents.push(...Array.from({ length: userTurnCount }, () => Date.now()));
    saveArtifact(artifact);
  }
}

artifact.completedAt = new Date().toISOString();
saveArtifact(artifact);

const passed = results.filter((entry) => entry.ok && entry.result.passed).length;
const errors = results.filter((entry) => !entry.ok).length;
console.log(`[${modelLabel}] complete: ${passed}/${results.length} passed, ${errors} transport errors`);
