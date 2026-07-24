import { z } from "zod";

const OBJECT_ID_PATTERN = /\b[a-f0-9]{24}\b/gi;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

const MODES_WITHOUT_JOB_RECOMMENDATIONS = new Set(["GUIDED", "DREAMJOB"]);

const EvaluationCheckSchema = z.object({
    name: z.string(),
    passed: z.boolean(),
    expected: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
    actual: z.union([z.string(), z.number(), z.boolean()]).optional(),
    message: z.string().optional(),
});

const ProviderMetadataSchema = z.object({
    caseId: z.string().optional(),
    runId: z.string().optional(),
    passed: z.boolean().optional(),
    mode: z.string().optional(),
    expected: z
        .object({
            mode: z.string().optional(),
            maxLines: z.number().optional(),
            mustAskQuestion: z.boolean().optional(),
            forbiddenWords: z.array(z.string()).optional(),
        })
        .optional(),
    checks: z.array(EvaluationCheckSchema).optional(),
    conversation: z
        .array(
            z.object({
                role: z.enum(["user", "assistant", "system"]),
                content: z.string(),
            }),
        )
        .optional(),
    jobCount: z.number().int().nonnegative().optional(),
    durationMs: z.number().optional(),
    conversationId: z.string().optional(),
    userId: z.string().optional(),
    userTurnCount: z.number().optional(),
    ranAt: z.string().optional(),
});

type AssertionContext = {
    vars?: Record<string, unknown>;
    providerResponse?: {
        output?: unknown;
        error?: string;
        metadata?: Record<string, unknown>;
    };
    metadata?: Record<string, unknown>;
};

type GradingResult = {
    pass: boolean;
    score: number;
    reason: string;
};

const asText = (output: unknown): string => {
    if (typeof output === "string") {
        return output;
    }
    if (output === undefined || output === null) {
        return "";
    }
    return JSON.stringify(output);
};

const readMetadata = (context: AssertionContext) => {
    const raw = context.providerResponse?.metadata ?? context.metadata ?? {};
    const parsed = ProviderMetadataSchema.safeParse(raw);
    return parsed.success ? parsed.data : {};
};

const fail = (reason: string): GradingResult => ({ pass: false, score: 0, reason });
const pass = (reason: string): GradingResult => ({ pass: true, score: 1, reason });

/** Assert the evaluation-service run result metadata is present and well-formed. */
export const assertValidRunResult = (_output: unknown, context: AssertionContext): GradingResult => {
    if (context.providerResponse?.error) {
        return fail(`Evaluation flow failed: ${context.providerResponse.error}`);
    }

    const metadata = readMetadata(context);
    if (!metadata.caseId || !metadata.runId || !Array.isArray(metadata.checks)) {
        return fail("Provider metadata is missing caseId, runId, or checks from the evaluation run result");
    }

    return pass("Evaluation run result metadata is valid");
};

/** Assert all deterministic checks from evaluation-runner.utils passed. */
export const assertExistingChecksPassed = (_output: unknown, context: AssertionContext): GradingResult => {
    if (context.providerResponse?.error) {
        return fail(`Evaluation flow failed: ${context.providerResponse.error}`);
    }

    const metadata = readMetadata(context);
    const checks = metadata.checks ?? [];

    if (checks.length === 0) {
        return fail("No evaluation checks were returned by the evaluation-service");
    }

    const failed = checks.filter((check) => !check.passed);
    if (failed.length > 0) {
        const details = failed.map((check) => check.message ?? `${check.name} failed`).join("; ");
        return fail(`Existing evaluation checks failed: ${details}`);
    }

    if (metadata.passed === false) {
        return fail("Evaluation-service reported passed=false");
    }

    return pass(`All ${checks.length} existing evaluation checks passed`);
};

/** Assert expected mode / classification matches the run result. */
export const assertExpectedMode = (_output: unknown, context: AssertionContext): GradingResult => {
    const metadata = readMetadata(context);
    const expectedModeFromVars = context.vars?.expected;
    const expectedMode =
        metadata.expected?.mode ??
        (typeof expectedModeFromVars === "object" &&
        expectedModeFromVars !== null &&
        "mode" in expectedModeFromVars &&
        typeof (expectedModeFromVars as { mode?: unknown }).mode === "string"
            ? (expectedModeFromVars as { mode: string }).mode
            : undefined);

    if (!expectedMode) {
        return pass("No expected mode configured for this case");
    }

    const actualMode = metadata.mode?.trim().toUpperCase();
    const normalizedExpected = expectedMode.trim().toUpperCase();

    if (actualMode !== normalizedExpected) {
        return fail(`Expected mode "${normalizedExpected}" but got "${actualMode ?? "unknown"}"`);
    }

    return pass(`Mode matched expected "${normalizedExpected}"`);
};

/** Assert the assistant reply does not contain Mongo ObjectIds or UUIDs. */
export const assertNoInternalIds = (output: unknown, _context: AssertionContext): GradingResult => {
    const reply = asText(output);
    const objectIds = reply.match(OBJECT_ID_PATTERN) ?? [];
    const uuids = reply.match(UUID_PATTERN) ?? [];

    if (objectIds.length > 0 || uuids.length > 0) {
        const found = [...objectIds, ...uuids].slice(0, 5).join(", ");
        return fail(`User-facing reply contains internal id(s): ${found}`);
    }

    return pass("Reply contains no internal ObjectIds or UUIDs");
};

/**
 * Assert no job recommendations when the conversation mode does not allow them
 * (GUIDED / DREAMJOB). NEAR_TERM may include jobs.
 */
export const assertNoJobsWhenModeDisallows = (_output: unknown, context: AssertionContext): GradingResult => {
    const metadata = readMetadata(context);
    const mode = (metadata.mode ?? metadata.expected?.mode)?.trim().toUpperCase();

    if (!mode || !MODES_WITHOUT_JOB_RECOMMENDATIONS.has(mode)) {
        return pass(`Mode "${mode ?? "unknown"}" allows job recommendations or has no mode constraint`);
    }

    const jobCount = metadata.jobCount ?? 0;
    if (jobCount > 0) {
        return fail(`Mode "${mode}" must not include job recommendations, but jobCount=${jobCount}`);
    }

    return pass(`Mode "${mode}" correctly returned no job recommendations`);
};

/** Assert required fields from expected vars are present in metadata.expected. */
export const assertRequiredExpectedFields = (_output: unknown, context: AssertionContext): GradingResult => {
    const metadata = readMetadata(context);
    const expected = metadata.expected;
    if (!expected) {
        return fail("Missing expected object in provider metadata");
    }

    const hasCheckable =
        expected.mode !== undefined ||
        expected.maxLines !== undefined ||
        expected.mustAskQuestion === true ||
        (expected.forbiddenWords?.length ?? 0) > 0;

    if (!hasCheckable) {
        return fail("Expected must include at least one of: mode, maxLines, mustAskQuestion, forbiddenWords");
    }

    return pass("Required expected fields are present");
};

/** Assert forbidden words from expected are not present in the reply (defensive double-check). */
export const assertForbiddenWordsAbsent = (output: unknown, context: AssertionContext): GradingResult => {
    const metadata = readMetadata(context);
    const forbiddenWords = metadata.expected?.forbiddenWords ?? [];
    if (forbiddenWords.length === 0) {
        return pass("No forbidden words configured");
    }

    const reply = asText(output).toLowerCase();
    const matched = forbiddenWords.filter((word) => reply.includes(word.toLowerCase()));
    if (matched.length > 0) {
        return fail(`Reply contains forbidden phrase(s): ${matched.join(", ")}`);
    }

    return pass("Reply contains no forbidden phrases");
};
