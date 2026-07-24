import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";
import {
    loadPromptfooEnv,
    toEvaluationProviderConfig,
    type EvaluationProviderConfig,
} from "./provider-env.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(packageRoot, ".env") });

const ProviderOptionsSchema = z
    .object({
        id: z.string().optional(),
        config: z
            .object({
                evaluationServiceBaseUrl: z.string().url().optional(),
                timeoutMs: z.number().int().positive().optional(),
                label: z.string().optional(),
            })
            .optional(),
    })
    .passthrough();

const EvaluationRunResultSchema = z.object({
    caseId: z.string(),
    runId: z.string(),
    passed: z.boolean(),
    reply: z.string(),
    conversation: z.array(
        z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string(),
        }),
    ),
    checks: z.array(
        z.object({
            name: z.string(),
            passed: z.boolean(),
            expected: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
            actual: z.union([z.string(), z.number(), z.boolean()]).optional(),
            message: z.string().optional(),
        }),
    ),
    expected: z.object({
        mode: z.string().optional(),
        maxLines: z.number().optional(),
        mustAskQuestion: z.boolean().optional(),
        forbiddenWords: z.array(z.string()).optional(),
    }),
    metadata: z.object({
        userId: z.string(),
        conversationId: z.string(),
        userTurnCount: z.number(),
        durationMs: z.number(),
        ranAt: z.string(),
    }),
    mode: z.string().optional(),
    jobCount: z.number().int().nonnegative().optional(),
    tokenUsage: z
        .object({
            prompt: z.number().int().nonnegative(),
            completion: z.number().int().nonnegative(),
            total: z.number().int().nonnegative(),
            requestCount: z.number().int().nonnegative(),
        })
        .optional(),
});

export type EvaluationRunResult = z.infer<typeof EvaluationRunResultSchema>;

type ProviderResponse = {
    output?: string;
    error?: string;
    metadata?: Record<string, unknown>;
    tokenUsage?: {
        prompt: number;
        completion: number;
        total: number;
        numRequests?: number;
    };
};

type CallApiContext = {
    vars?: Record<string, unknown>;
};

const parseJsonResponse = async (response: Response): Promise<unknown> => response.json().catch(() => null);

const readErrorMessage = async (response: Response): Promise<string> => {
    const payload = await parseJsonResponse(response);
    if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
        return payload.error;
    }
    return `Evaluation service responded with status ${response.status}`;
};

const resolveCaseId = (prompt: string, context?: CallApiContext): string => {
    const fromVars = context?.vars?.caseId;
    if (typeof fromVars === "string" && fromVars.trim().length > 0) {
        return fromVars.trim();
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length > 0) {
        return trimmedPrompt;
    }

    throw new Error("Evaluation case id is required (vars.caseId or prompt)");
};

export default class EvaluationProvider {
    readonly providerId: string;
    readonly config: EvaluationProviderConfig;

    constructor(options: unknown = {}) {
        const parsed = ProviderOptionsSchema.parse(options ?? {});
        const env = loadPromptfooEnv();
        this.config = toEvaluationProviderConfig(env, {
            evaluationServiceBaseUrl: parsed.config?.evaluationServiceBaseUrl,
            timeoutMs: parsed.config?.timeoutMs,
            label: parsed.config?.label,
        });
        this.providerId = parsed.id ?? parsed.config?.label ?? "careercoach-evaluation";
    }

    id(): string {
        return this.providerId;
    }

    async callApi(prompt: string, context?: CallApiContext): Promise<ProviderResponse> {
        try {
            const caseId = resolveCaseId(prompt, context);
            const url = `${this.config.evaluationServiceBaseUrl.replace(/\/$/, "")}/evaluation-cases/${encodeURIComponent(caseId)}/run`;
            const controller = new AbortController();
            const timeoutHandle = setTimeout(() => controller.abort(), this.config.timeoutMs);

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    return {
                        error: await readErrorMessage(response),
                        metadata: { statusCode: response.status, caseId },
                    };
                }

                const payload = await parseJsonResponse(response);
                const parsed = EvaluationRunResultSchema.safeParse(payload);
                if (!parsed.success) {
                    return {
                        error: `Evaluation service returned an invalid run result: ${parsed.error.message}`,
                        metadata: { caseId, issues: parsed.error.issues },
                    };
                }

                const result = parsed.data;
                const tokenUsage = result.tokenUsage ?? {
                    prompt: 0,
                    completion: 0,
                    total: 0,
                    requestCount: 0,
                };
                return {
                    output: result.reply,
                    tokenUsage: {
                        prompt: tokenUsage.prompt,
                        completion: tokenUsage.completion,
                        total: tokenUsage.total,
                        numRequests: tokenUsage.requestCount,
                    },
                    metadata: {
                        caseId: result.caseId,
                        runId: result.runId,
                        passed: result.passed,
                        mode: result.mode,
                        expected: result.expected,
                        checks: result.checks,
                        conversation: result.conversation,
                        jobCount: result.jobCount ?? 0,
                        tokenUsage,
                        durationMs: result.metadata.durationMs,
                        conversationId: result.metadata.conversationId,
                        userId: result.metadata.userId,
                        userTurnCount: result.metadata.userTurnCount,
                        ranAt: result.metadata.ranAt,
                        providerLabel: this.config.label ?? this.providerId,
                    },
                };
            } finally {
                clearTimeout(timeoutHandle);
            }
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                return {
                    error: `Timed out after ${this.config.timeoutMs}ms waiting for evaluation-service`,
                };
            }

            return {
                error: error instanceof Error ? error.message : "Unknown evaluation provider error",
            };
        }
    }
}
