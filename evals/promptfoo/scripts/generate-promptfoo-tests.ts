import { config as loadDotenv } from "dotenv";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import { z } from "zod";
import { loadPromptfooEnv } from "../providers/provider-env.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(packageRoot, ".env") });

const MessageRoleSchema = z.enum(["user", "assistant", "system"]);

const EvaluationMessageSchema = z.object({
    role: MessageRoleSchema,
    content: z.string().min(1),
});

const EvaluationExpectedSchema = z
    .object({
        mode: z.string().optional(),
        maxLines: z.number().optional(),
        mustAskQuestion: z.boolean().optional(),
        forbiddenWords: z.array(z.string()).optional(),
    })
    .refine(
        (expected) =>
            expected.mode !== undefined ||
            expected.maxLines !== undefined ||
            expected.mustAskQuestion !== undefined ||
            (Array.isArray(expected.forbiddenWords) && expected.forbiddenWords.length > 0),
        {
            message: "expected must include at least one of: mode, maxLines, mustAskQuestion, forbiddenWords",
        },
    );

const EvaluationCaseFixtureSchema = z.object({
    id: z.string().min(1),
    messages: z.array(EvaluationMessageSchema).min(1),
    expected: EvaluationExpectedSchema,
});

type EvaluationCaseFixture = z.infer<typeof EvaluationCaseFixtureSchema>;

type PromptfooAssertion = {
    type: string;
    value?: string;
    threshold?: number;
};

type PromptfooTestCase = {
    description: string;
    vars: {
        caseId: string;
        messages: EvaluationCaseFixture["messages"];
        expected: EvaluationCaseFixture["expected"];
        rubric?: string;
    };
    tags?: string[];
    assert: PromptfooAssertion[];
};

const FIXTURES_DIR = path.resolve(packageRoot, "../../evaluation-service/fixtures/evaluation-cases");
const GENERATED_DIR = path.join(packageRoot, "generated");
const GENERATED_TESTS_PATH = path.join(GENERATED_DIR, "tests.yaml");

const DETERMINISTIC_ASSERTIONS: PromptfooAssertion[] = [
    { type: "javascript", value: "file://assertions/custom-assertions.ts:assertValidRunResult" },
    { type: "javascript", value: "file://assertions/custom-assertions.ts:assertExistingChecksPassed" },
    { type: "javascript", value: "file://assertions/custom-assertions.ts:assertExpectedMode" },
    { type: "javascript", value: "file://assertions/custom-assertions.ts:assertRequiredExpectedFields" },
    { type: "javascript", value: "file://assertions/custom-assertions.ts:assertForbiddenWordsAbsent" },
    { type: "javascript", value: "file://assertions/custom-assertions.ts:assertNoInternalIds" },
    { type: "javascript", value: "file://assertions/custom-assertions.ts:assertNoJobsWhenModeDisallows" },
];

const LLM_RUBRIC_ASSERTIONS: PromptfooAssertion[] = [
    {
        type: "llm-rubric",
        value:
            "The assistant reply is relevant to the user's latest message and the conversation context.",
        threshold: 0.7,
    },
    {
        type: "llm-rubric",
        value:
            "The assistant follows the implied career-coaching instructions: helpful, professional, and does not invent employer offers or fake job listings.",
        threshold: 0.7,
    },
    {
        type: "llm-rubric",
        value:
            "When the assistant asks a question, it asks one focused question rather than many questions at once.",
        threshold: 0.7,
    },
    {
        type: "llm-rubric",
        value:
            "The assistant avoids repeating information the user already stated unless a brief acknowledgment is useful.",
        threshold: 0.7,
    },
    {
        type: "llm-rubric",
        value:
            "The reply progresses the conversation correctly toward clarifying goals, constraints, or next steps.",
        threshold: 0.7,
    },
    {
        type: "llm-rubric",
        value:
            "If recommendations appear, they are grounded in the supplied conversation data and do not invent unsupported facts.",
        threshold: 0.7,
    },
];

const deriveTags = (caseId: string): string[] => {
    const tags: string[] = [];
    if (caseId.includes("guided")) {
        tags.push("guided");
    }
    if (caseId.includes("fast-search")) {
        tags.push("near-term", "fast-search");
    }
    if (caseId.includes("deep-discovery")) {
        tags.push("guided", "deep-discovery");
    }
    if (caseId.includes("dreamjob")) {
        tags.push("dreamjob");
    }
    if (caseId.includes("check")) {
        tags.push("checks");
    }
    if (caseId.includes("jailbreak") || caseId.includes("malicious") || caseId.includes("illegal")) {
        tags.push("safety");
    }
    return [...new Set(tags)];
};

const buildRubricSummary = (fixture: EvaluationCaseFixture): string => {
    const parts: string[] = [];
    if (fixture.expected.mode) {
        parts.push(`Expected conversation mode: ${fixture.expected.mode}.`);
    }
    if (fixture.expected.mustAskQuestion === true) {
        parts.push("The assistant should ask a clarifying question.");
    }
    if (fixture.expected.maxLines !== undefined) {
        parts.push(`Keep the reply to at most ${fixture.expected.maxLines} non-empty lines.`);
    }
    if (fixture.expected.forbiddenWords && fixture.expected.forbiddenWords.length > 0) {
        parts.push(`Do not use forbidden phrases: ${fixture.expected.forbiddenWords.join(", ")}.`);
    }
    return parts.join(" ");
};

const loadFixtures = async (): Promise<EvaluationCaseFixture[]> => {
    const entries = await readdir(FIXTURES_DIR);
    const jsonFiles = entries.filter((name) => name.startsWith("eval-") && name.endsWith(".json")).sort();

    const fixtures: EvaluationCaseFixture[] = [];
    for (const fileName of jsonFiles) {
        const raw = await readFile(path.join(FIXTURES_DIR, fileName), "utf8");
        const parsedJson: unknown = JSON.parse(raw);
        const parsed = EvaluationCaseFixtureSchema.safeParse(parsedJson);
        if (!parsed.success) {
            throw new Error(`Invalid fixture ${fileName}: ${parsed.error.message}`);
        }
        fixtures.push(parsed.data);
    }

    return fixtures;
};

const toPromptfooTest = (fixture: EvaluationCaseFixture, enableJudge: boolean): PromptfooTestCase => {
    const assertions = [...DETERMINISTIC_ASSERTIONS];
    if (enableJudge) {
        assertions.push(...LLM_RUBRIC_ASSERTIONS);
    }

    return {
        description: fixture.id,
        vars: {
            caseId: fixture.id,
            messages: fixture.messages,
            expected: fixture.expected,
            rubric: buildRubricSummary(fixture),
        },
        tags: deriveTags(fixture.id),
        assert: assertions,
    };
};

const main = async (): Promise<void> => {
    const env = loadPromptfooEnv();
    const fixtures = await loadFixtures();
    const tests = fixtures.map((fixture) => toPromptfooTest(fixture, env.PROMPTFOO_ENABLE_JUDGE));

    await mkdir(GENERATED_DIR, { recursive: true });

    const yamlBody = stringify(tests, {
        lineWidth: 120,
        defaultStringType: "QUOTE_DOUBLE",
        defaultKeyType: "PLAIN",
    });

    const header = [
        "# AUTO-GENERATED by scripts/generate-promptfoo-tests.ts",
        "# Do not edit by hand. Re-run: npm run update (or npm run eval:promptfoo:update from repo root)",
        `# Source: evaluation-service/fixtures/evaluation-cases (count=${tests.length})`,
        `# Judge assertions: ${env.PROMPTFOO_ENABLE_JUDGE ? "enabled" : "disabled"}`,
        "",
    ].join("\n");

    await writeFile(GENERATED_TESTS_PATH, `${header}${yamlBody}`, "utf8");
    console.log(`Wrote ${tests.length} Promptfoo tests to ${GENERATED_TESTS_PATH}`);
};

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
