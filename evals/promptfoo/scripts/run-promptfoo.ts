import { config as loadDotenv } from "dotenv";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPromptfooEnv } from "../providers/provider-env.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(packageRoot, ".env") });

const env = loadPromptfooEnv();

process.env.EVALUATION_SERVICE_BASE_URL = env.EVALUATION_SERVICE_BASE_URL;
process.env.CANDIDATE_EVALUATION_SERVICE_BASE_URL =
    env.CANDIDATE_EVALUATION_SERVICE_BASE_URL ?? env.EVALUATION_SERVICE_BASE_URL;
process.env.PROMPTFOO_JUDGE_PROVIDER = env.PROMPTFOO_JUDGE_PROVIDER ?? "openai";
process.env.PROMPTFOO_JUDGE_MODEL = env.PROMPTFOO_JUDGE_MODEL ?? "gpt-4o-mini";
process.env.PROMPTFOO_ENABLE_JUDGE = String(env.PROMPTFOO_ENABLE_JUDGE);
process.env.PROMPTFOO_PASS_THRESHOLD = String(env.PROMPTFOO_PASS_THRESHOLD);
process.env.PROMPTFOO_MAX_CONCURRENCY = String(env.PROMPTFOO_MAX_CONCURRENCY);
process.env.PROMPTFOO_TIMEOUT_MS = String(env.PROMPTFOO_TIMEOUT_MS);

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Usage: tsx scripts/run-promptfoo.ts <promptfoo-args...>");
    process.exitCode = 1;
    process.exit();
}

const promptfooBin = path.join(packageRoot, "node_modules", ".bin", "promptfoo");
const child = spawn(promptfooBin, args, {
    cwd: packageRoot,
    env: process.env,
    stdio: "inherit",
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 1);
});
