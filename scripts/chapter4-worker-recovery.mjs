import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const readArgument = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
};

const parseEnvValue = (path, name) => readFileSync(path, "utf8")
  .split(/\r?\n/)
  .find((line) => line.startsWith(`${name}=`))
  ?.slice(name.length + 1)
  .trim()
  .replace(/^['"]|['"]$/g, "");

const chatUrl = readArgument("chat-url");
const userId = readArgument("user-id");
const workerPid = Number(readArgument("worker-pid"));
const outputPath = readArgument("output");
const internalServiceApiKey = parseEnvValue("evaluation-service/.env", "INTERNAL_SERVICE_API_KEY");

if (!chatUrl || !userId || !Number.isInteger(workerPid) || !outputPath || !internalServiceApiKey) {
  throw new Error("Missing required worker-recovery argument or INTERNAL_SERVICE_API_KEY");
}

const headers = { "X-Internal-Service-Key": internalServiceApiKey };
const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

const fetchJson = async (url, init = {}) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
};

const pollUntil = async (requestId, predicate, deadline) => {
  if (Date.now() >= deadline) {
    throw new Error("Timed out waiting for chat request state");
  }
  const status = await fetchJson(`${chatUrl}/chat/requests/${encodeURIComponent(requestId)}?userId=${encodeURIComponent(userId)}`, { headers });
  if (predicate(status)) {
    return status;
  }
  await sleep(250);
  return pollUntil(requestId, predicate, deadline);
};

const experimentStartedAt = new Date().toISOString();
const conversation = await fetchJson(`${chatUrl}/chat/users/${encodeURIComponent(userId)}/conversations`, {
  method: "POST",
  headers,
});
const enqueueStart = performance.now();
const queued = await fetchJson(`${chatUrl}/chat/message`, {
  method: "POST",
  headers: { ...headers, "content-type": "application/json" },
  body: JSON.stringify({
    userId,
    conversationId: conversation.conversationId,
    message: "I am a backend developer with TypeScript and MongoDB experience. What should I focus on next?",
  }),
});
const enqueueLatencyMs = performance.now() - enqueueStart;
const started = await pollUntil(queued.requestId, (status) => status.status === "started", Date.now() + 60_000);
const killedAt = new Date().toISOString();
process.kill(workerPid, "SIGKILL");
const recoveryStart = performance.now();
const finalStatus = await pollUntil(
  queued.requestId,
  (status) => status.status === "completed" || status.status === "failed",
  Date.now() + 360_000,
);
const recoveryDurationMs = performance.now() - recoveryStart;

const artifact = {
  protocolVersion: 1,
  experimentStartedAt,
  userId,
  conversationId: conversation.conversationId,
  requestId: queued.requestId,
  enqueueLatencyMs,
  statusBeforeInterruption: started.status,
  interruptedWorkerPid: workerPid,
  killedAt,
  finalStatus: finalStatus.status,
  finalError: finalStatus.error ?? null,
  recoveryDurationMs,
  completedAt: new Date().toISOString(),
};

writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify(artifact, null, 2));
