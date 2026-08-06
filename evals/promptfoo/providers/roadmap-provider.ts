import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";
import { loadPromptfooEnv } from "./provider-env.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(packageRoot, ".env") });

const ProviderOptionsSchema = z
    .object({
        id: z.string().optional(),
        config: z
            .object({
                roadmapServiceBaseUrl: z.string().url().optional(),
                timeoutMs: z.number().int().positive().optional(),
                label: z.string().optional(),
            })
            .optional(),
    })
    .passthrough();

type ProviderResponse = {
    output?: string;
    error?: string;
    metadata?: Record<string, unknown>;
};

const CallApiContextSchema = z
    .object({
        vars: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough();

export default class RoadmapEvaluationProvider {
    private readonly roadmapServiceBaseUrl: string;
    private readonly timeoutMs: number;
    private readonly label: string;

    constructor(options: unknown) {
        const env = loadPromptfooEnv();
        const parsed = ProviderOptionsSchema.parse(options ?? {});
        this.roadmapServiceBaseUrl = (
            parsed.config?.roadmapServiceBaseUrl ??
            env.ROADMAP_SERVICE_BASE_URL ??
            "http://127.0.0.1:3005"
        ).replace(/\/$/, "");
        this.timeoutMs = parsed.config?.timeoutMs ?? env.PROMPTFOO_TIMEOUT_MS;
        this.label = parsed.config?.label ?? "roadmap-eval";
    }

    id = (): string => `roadmap-evaluation-provider:${this.label}`;

    callApi = async (_prompt: string, context?: unknown): Promise<ProviderResponse> => {
        const parsedContext = CallApiContextSchema.safeParse(context ?? {});
        const vars = parsedContext.success ? parsedContext.data.vars ?? {} : {};
        const caseId = typeof vars.caseId === "string" ? vars.caseId : "unknown";
        const request = vars.request;
        if (typeof request !== "object" || request === null) {
            return { error: `Missing request vars for case ${caseId}` };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(`${this.roadmapServiceBaseUrl}/roadmap/generate/eval-fixture`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...(request as Record<string, unknown>), caseId }),
                signal: controller.signal,
            });
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                const message =
                    typeof payload === "object" &&
                    payload !== null &&
                    "error" in payload &&
                    typeof (payload as { error: unknown }).error === "string"
                        ? (payload as { error: string }).error
                        : `HTTP ${response.status}`;
                return { error: `Roadmap fixture generate failed: ${message}` };
            }
            return {
                output: JSON.stringify(payload),
                metadata: {
                    caseId,
                    label: this.label,
                    endpoint: "/roadmap/generate/eval-fixture",
                },
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                error: `Roadmap provider call failed (${this.roadmapServiceBaseUrl}): ${message}`,
            };
        } finally {
            clearTimeout(timer);
        }
    };
}
