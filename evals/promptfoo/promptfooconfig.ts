import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPromptfooEnv } from "./providers/provider-env.ts";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(packageRoot, ".env") });

const env = loadPromptfooEnv();

const judgeProvider =
    env.PROMPTFOO_JUDGE_PROVIDER && env.PROMPTFOO_JUDGE_MODEL
        ? `${env.PROMPTFOO_JUDGE_PROVIDER}:${env.PROMPTFOO_JUDGE_MODEL}`
        : undefined;

/** Promptfoo UnifiedConfig (threshold is accepted at runtime; types omit it in some versions). */
const config = {
    description: "CareerCoach evaluation regression via evaluation-service",
    prompts: ["{{caseId}}"],
    providers: [
        {
            id: "file://providers/evaluation-provider.ts",
            label: "careercoach-evaluation-baseline",
            config: {
                evaluationServiceBaseUrl: env.EVALUATION_SERVICE_BASE_URL,
                timeoutMs: env.PROMPTFOO_TIMEOUT_MS,
                label: "baseline",
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
    outputPath: "output/promptfoo-results.json",
    threshold: env.PROMPTFOO_PASS_THRESHOLD,
};

export default config;
