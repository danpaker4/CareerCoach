import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPromptfooEnv } from "./providers/provider-env.ts";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(packageRoot, ".env") });

const env = loadPromptfooEnv();
const candidateBaseUrl = env.CANDIDATE_EVALUATION_SERVICE_BASE_URL ?? env.EVALUATION_SERVICE_BASE_URL;

const judgeProvider =
    env.PROMPTFOO_JUDGE_PROVIDER && env.PROMPTFOO_JUDGE_MODEL
        ? `${env.PROMPTFOO_JUDGE_PROVIDER}:${env.PROMPTFOO_JUDGE_MODEL}`
        : undefined;

/** Promptfoo UnifiedConfig (threshold is accepted at runtime; types omit it in some versions). */
const config = {
    description: "CareerCoach baseline vs candidate evaluation comparison",
    prompts: ["{{caseId}}"],
    providers: [
        {
            id: "file://providers/evaluation-provider.ts",
            label: "baseline",
            config: {
                evaluationServiceBaseUrl: env.EVALUATION_SERVICE_BASE_URL,
                label: "baseline",
                timeoutMs: env.PROMPTFOO_TIMEOUT_MS,
            },
        },
        {
            id: "file://providers/evaluation-provider.ts",
            label: "candidate",
            config: {
                evaluationServiceBaseUrl: candidateBaseUrl,
                label: "candidate",
                timeoutMs: env.PROMPTFOO_TIMEOUT_MS,
            },
        },
    ],
    tests: "file://generated/tests.yaml",
    defaultTest: judgeProvider
        ? {
              options: {
                  provider: judgeProvider,
              },
          }
        : undefined,
    evaluateOptions: {
        maxConcurrency: env.PROMPTFOO_MAX_CONCURRENCY,
        showProgressBar: true,
    },
    outputPath: "output/promptfoo-compare-results.json",
    threshold: env.PROMPTFOO_PASS_THRESHOLD,
};

export default config;
