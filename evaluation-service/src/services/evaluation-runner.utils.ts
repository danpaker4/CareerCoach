import type { EvaluationExpected } from "../schemas/evaluation-case.schema";
import type { EvaluationCheckResult } from "./evaluation-runner.types";

export const extractUserMessages = (messages: Array<{ role: string; content: string }>): string[] =>
    messages.filter((message) => message.role === "user").map((message) => message.content.trim()).filter((content) => content.length > 0);

export const countNonEmptyLines = (text: string): number =>
    text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0).length;

export const replyAsksQuestion = (reply: string): boolean => {
    if (reply.includes("?")) {
        return true;
    }

    return /\b(what|how|why|when|where|which|who|could you|would you|can you|tell me|share)\b/i.test(reply);
};

const normalizeMode = (value: string | undefined): string | undefined =>
    value?.trim().toUpperCase();

export const hasCheckableExpected = (expected: EvaluationExpected): boolean =>
    expected.mode !== undefined ||
    expected.maxLines !== undefined ||
    expected.mustAskQuestion === true ||
    (expected.forbiddenWords?.length ?? 0) > 0;

export const evaluateAssistantReply = (params: {
    reply: string;
    expected: EvaluationExpected;
    actualMode: string | undefined;
}): EvaluationCheckResult[] => {
    const { reply, expected, actualMode } = params;
    const checks: EvaluationCheckResult[] = [];

    if (expected.maxLines !== undefined) {
        const lineCount = countNonEmptyLines(reply);
        const maxLinesPassed = lineCount <= expected.maxLines;
        checks.push({
            name: "maxLines",
            passed: maxLinesPassed,
            expected: expected.maxLines,
            actual: lineCount,
            message: maxLinesPassed ? undefined : `Reply has ${lineCount} non-empty lines, expected at most ${expected.maxLines}`,
        });
    }

    if (expected.mustAskQuestion === true) {
        const asksQuestion = replyAsksQuestion(reply);
        checks.push({
            name: "mustAskQuestion",
            passed: asksQuestion,
            expected: true,
            actual: asksQuestion,
            message: asksQuestion ? undefined : "Reply should include a question",
        });
    }

    if (expected.mode !== undefined) {
        const normalizedExpectedMode = normalizeMode(expected.mode);
        const normalizedActualMode = normalizeMode(actualMode);
        const modePassed = normalizedExpectedMode === normalizedActualMode;
        checks.push({
            name: "mode",
            passed: modePassed,
            expected: expected.mode,
            actual: actualMode ?? "unknown",
            message: modePassed
                ? undefined
                : `Expected mode "${expected.mode}" but chat mode was "${actualMode ?? "unknown"}"`,
        });
    }

    if (expected.forbiddenWords && expected.forbiddenWords.length > 0) {
        const lowerReply = reply.toLowerCase();
        const matchedForbidden = expected.forbiddenWords.filter((word) => lowerReply.includes(word.toLowerCase()));
        const forbiddenPassed = matchedForbidden.length === 0;
        checks.push({
            name: "forbiddenWords",
            passed: forbiddenPassed,
            expected: expected.forbiddenWords,
            actual: matchedForbidden.join(", ") || "none",
            message: forbiddenPassed ? undefined : `Reply contains forbidden phrase(s): ${matchedForbidden.join(", ")}`,
        });
    }

    return checks;
};

export const aggregatePassed = (checks: EvaluationCheckResult[]): boolean => checks.every((check) => check.passed);
