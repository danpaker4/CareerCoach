import { z } from "zod";

const optionalEmptyString = (value: unknown): unknown => (value === "" ? undefined : value);

export const PromptfooEnvSchema = z.object({
    EVALUATION_SERVICE_BASE_URL: z.string().url().default("http://127.0.0.1:3004"),
    CANDIDATE_EVALUATION_SERVICE_BASE_URL: z.preprocess(
        optionalEmptyString,
        z.string().url().optional(),
    ),
    PROMPTFOO_JUDGE_PROVIDER: z.preprocess(optionalEmptyString, z.string().min(1).optional()),
    PROMPTFOO_JUDGE_MODEL: z.preprocess(optionalEmptyString, z.string().min(1).optional()),
    PROMPTFOO_ENABLE_JUDGE: z
        .preprocess((value) => {
            if (value === undefined || value === "") {
                return false;
            }
            if (typeof value === "boolean") {
                return value;
            }
            return String(value).toLowerCase() === "true";
        }, z.boolean())
        .default(false),
    PROMPTFOO_PASS_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
    PROMPTFOO_MAX_CONCURRENCY: z.coerce.number().int().positive().default(1),
    PROMPTFOO_TIMEOUT_MS: z.coerce.number().int().positive().default(1_200_000),
});

export type PromptfooEnv = z.infer<typeof PromptfooEnvSchema>;

export type EvaluationProviderConfig = {
    evaluationServiceBaseUrl: string;
    timeoutMs: number;
    label?: string;
};

export const loadPromptfooEnv = (env: NodeJS.ProcessEnv = process.env): PromptfooEnv =>
    PromptfooEnvSchema.parse(env);

export const toEvaluationProviderConfig = (
    env: PromptfooEnv,
    overrides?: Partial<EvaluationProviderConfig>,
): EvaluationProviderConfig => ({
    evaluationServiceBaseUrl: overrides?.evaluationServiceBaseUrl ?? env.EVALUATION_SERVICE_BASE_URL,
    timeoutMs: overrides?.timeoutMs ?? env.PROMPTFOO_TIMEOUT_MS,
    label: overrides?.label,
});
