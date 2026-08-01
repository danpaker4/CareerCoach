import { z } from "zod";

const StageSchema = z.object({
    label: z.string(),
    description: z.string(),
    actions: z.array(z.string()),
    howToGetThere: z.string().optional(),
    whatYouGain: z.string().optional(),
    requiredCapabilities: z.array(z.string()).optional(),
    skillsToBuild: z.array(z.string()).optional(),
    estimatedTimeframe: z.string().optional(),
    reasonCodes: z.array(z.string()).optional(),
});

const RoadmapOutputSchema = z.object({
    stages: z.array(StageSchema).min(1),
    removedInputExamples: z
        .array(
            z.object({
                input: z.string(),
                reason: z.string(),
            }),
        )
        .optional(),
    selectedCareerPath: z.array(z.string()).optional(),
    progressionMeta: z
        .object({
            selectedCareerPath: z.array(z.string()).optional(),
            removedInputExamples: z
                .array(
                    z.object({
                        input: z.string(),
                        reason: z.string(),
                    }),
                )
                .optional(),
        })
        .passthrough()
        .optional(),
    generationMode: z.string().optional(),
});

export type RoadmapEvalExpected = {
    minStages?: number;
    firstStageLabelIncludes?: string[];
    firstStageLabelMustNotInclude?: string[];
    mustIncludeStageLabelPatterns?: string[];
    requireHowToGetThere?: boolean;
    requireWhatYouGain?: boolean;
    maxRequiredCapabilitiesPerStage?: number;
    forbidCapabilityPatterns?: string[];
    degreeTimelineMustMentionYears?: boolean;
    mustRemoveNoise?: boolean;
};

type AssertionContext = {
    vars?: Record<string, unknown>;
    providerResponse?: {
        output?: unknown;
        error?: string;
        metadata?: Record<string, unknown>;
    };
};

type GradingResult = {
    pass: boolean;
    score: number;
    reason: string;
};

const parseOutput = (output: unknown) => {
    if (typeof output === "string") {
        try {
            return RoadmapOutputSchema.safeParse(JSON.parse(output));
        } catch {
            return RoadmapOutputSchema.safeParse(null);
        }
    }
    return RoadmapOutputSchema.safeParse(output);
};

const readExpected = (context: AssertionContext): RoadmapEvalExpected => {
    const raw = context.vars?.expected;
    if (typeof raw !== "object" || raw === null) return {};
    return raw as RoadmapEvalExpected;
};

const fail = (reason: string): GradingResult => ({ pass: false, score: 0, reason });
const pass = (reason: string): GradingResult => ({ pass: true, score: 1, reason });

const textBlobForStage = (stage: z.infer<typeof StageSchema>): string =>
    [
        stage.label,
        ...(stage.requiredCapabilities ?? []),
        ...(stage.skillsToBuild ?? []),
        ...stage.actions,
    ]
        .join("\n")
        .toLowerCase();

export const assertRoadmapValidShape = async (
    output: unknown,
    context: AssertionContext,
): Promise<GradingResult> => {
    if (context.providerResponse?.error) {
        return fail(`Provider error: ${context.providerResponse.error}`);
    }
    const parsed = parseOutput(output);
    if (!parsed.success) {
        return fail(`Invalid roadmap output: ${parsed.error.message}`);
    }
    return pass(`Valid roadmap with ${parsed.data.stages.length} stages`);
};

export const assertRoadmapStageCount = async (
    output: unknown,
    context: AssertionContext,
): Promise<GradingResult> => {
    const parsed = parseOutput(output);
    if (!parsed.success) return fail("Invalid roadmap output");
    const expected = readExpected(context);
    const minStages = expected.minStages ?? 2;
    if (parsed.data.stages.length < minStages) {
        return fail(`Expected at least ${minStages} stages, got ${parsed.data.stages.length}`);
    }
    return pass(`Stage count OK (${parsed.data.stages.length} >= ${minStages})`);
};

export const assertBeginnerDegreeThenJobPath = async (
    output: unknown,
    context: AssertionContext,
): Promise<GradingResult> => {
    const parsed = parseOutput(output);
    if (!parsed.success) return fail("Invalid roadmap output");
    const expected = readExpected(context);
    const first = parsed.data.stages[0];
    if (!first) return fail("No stages");

    for (const needle of expected.firstStageLabelIncludes ?? []) {
        if (!new RegExp(needle, "i").test(first.label)) {
            return fail(`First stage label missing /${needle}/i: "${first.label}"`);
        }
    }
    for (const needle of expected.firstStageLabelMustNotInclude ?? []) {
        if (new RegExp(needle, "i").test(first.label)) {
            return fail(`First stage label unexpectedly includes /${needle}/i: "${first.label}"`);
        }
    }
    for (const pattern of expected.mustIncludeStageLabelPatterns ?? []) {
        const matched = parsed.data.stages.some((stage) => new RegExp(pattern, "i").test(stage.label));
        if (!matched) {
            return fail(`No stage label matched /${pattern}/i`);
        }
    }
    return pass("Stage path labels match expected career progression");
};

export const assertHowAndGainFields = async (
    output: unknown,
    context: AssertionContext,
): Promise<GradingResult> => {
    const parsed = parseOutput(output);
    if (!parsed.success) return fail("Invalid roadmap output");
    const expected = readExpected(context);
    if (expected.requireHowToGetThere !== true && expected.requireWhatYouGain !== true) {
        return pass("How/gain checks not required for this case");
    }
    for (const stage of parsed.data.stages) {
        if (expected.requireHowToGetThere === true && (stage.howToGetThere?.trim().length ?? 0) < 40) {
            return fail(`Stage "${stage.label}" missing howToGetThere`);
        }
        if (expected.requireWhatYouGain === true && (stage.whatYouGain?.trim().length ?? 0) < 40) {
            return fail(`Stage "${stage.label}" missing whatYouGain`);
        }
    }
    return pass("All stages include how-to-get-there and what-you-gain guidance");
};

export const assertNoFluffCapabilities = async (
    output: unknown,
    context: AssertionContext,
): Promise<GradingResult> => {
    const parsed = parseOutput(output);
    if (!parsed.success) return fail("Invalid roadmap output");
    const expected = readExpected(context);
    const patterns = expected.forbidCapabilityPatterns ?? [];
    for (const stage of parsed.data.stages) {
        const blob = textBlobForStage(stage);
        for (const pattern of patterns) {
            if (new RegExp(pattern, "i").test(blob)) {
                return fail(`Stage "${stage.label}" contains forbidden pattern /${pattern}/i`);
            }
        }
        const maxCaps = expected.maxRequiredCapabilitiesPerStage ?? 6;
        if ((stage.requiredCapabilities?.length ?? 0) > maxCaps) {
            return fail(`Stage "${stage.label}" has too many requiredCapabilities`);
        }
    }
    return pass("No fluff capabilities and capability counts within limits");
};

export const assertDegreeTimelineYears = async (
    output: unknown,
    context: AssertionContext,
): Promise<GradingResult> => {
    const parsed = parseOutput(output);
    if (!parsed.success) return fail("Invalid roadmap output");
    const expected = readExpected(context);
    if (expected.degreeTimelineMustMentionYears !== true) {
        return pass("Degree timeline check not required");
    }
    const degreeStage = parsed.data.stages.find((stage) => /degree|foundation/i.test(stage.label));
    if (!degreeStage) {
        return fail("No degree/foundation stage found");
    }
    const timeframe = degreeStage.estimatedTimeframe ?? "";
    if (!/year/i.test(timeframe)) {
        return fail(`Degree stage timeframe should mention years, got "${timeframe}"`);
    }
    if (/week/i.test(timeframe) && !/year/i.test(timeframe)) {
        return fail(`Degree stage timeframe looks like weeks only: "${timeframe}"`);
    }
    return pass(`Degree timeframe looks multi-year: "${timeframe}"`);
};

export const assertNoiseRemoved = async (
    output: unknown,
    context: AssertionContext,
): Promise<GradingResult> => {
    const parsed = parseOutput(output);
    if (!parsed.success) return fail("Invalid roadmap output");
    const expected = readExpected(context);
    if (expected.mustRemoveNoise !== true) {
        return pass("Noise removal check not required");
    }
    const removed =
        parsed.data.removedInputExamples ?? parsed.data.progressionMeta?.removedInputExamples ?? [];
    if (removed.length === 0) {
        return fail("Expected removedInputExamples for noisy market cleanup");
    }
    const reasons = new Set(removed.map((item) => item.reason));
    const useful = ["job-ad-text", "personal-trait", "years-as-skill", "company-name"];
    if (!useful.some((reason) => reasons.has(reason))) {
        return fail(`removedInputExamples missing expected reason kinds; got ${[...reasons].join(", ")}`);
    }
    return pass(`Noise removed (${removed.length} examples)`);
};
