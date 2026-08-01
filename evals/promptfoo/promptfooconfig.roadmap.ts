import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPromptfooEnv } from "./providers/provider-env.ts";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(packageRoot, ".env") });

const env = loadPromptfooEnv();

const config = {
    description: "CareerCoach dream-job roadmap generation quality via roadmap-service eval fixtures",
    prompts: ["{{caseId}}"],
    providers: [
        {
            id: "file://providers/roadmap-provider.ts",
            label: "careercoach-roadmap-eval",
            config: {
                roadmapServiceBaseUrl: env.ROADMAP_SERVICE_BASE_URL,
                timeoutMs: env.PROMPTFOO_TIMEOUT_MS,
                label: "roadmap",
            },
        },
    ],
    tests: "file://generated/roadmap-tests.yaml",
    evaluateOptions: {
        maxConcurrency: env.PROMPTFOO_MAX_CONCURRENCY,
        showProgressBar: true,
    },
    outputPath: "output/promptfoo-roadmap-results.json",
    threshold: env.PROMPTFOO_PASS_THRESHOLD,
};

export default config;
