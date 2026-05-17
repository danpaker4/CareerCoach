import type { ConversationStageId } from "../evaluation-case.stage.consts";
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

export const matchesExpectedStage = (expectedStage: ConversationStageId, actualStage: string | undefined): boolean =>
    expectedStage === actualStage;

export const evaluateAssistantReply = (params: {
    reply: string;
    expected: EvaluationExpected;
    actualStage: string | undefined;
}): EvaluationCheckResult[] => {
    const { reply, expected, actualStage } = params;
    const checks: EvaluationCheckResult[] = [];

    const stagePassed = matchesExpectedStage(expected.stage, actualStage);
    checks.push({
        name: "stage",
        passed: stagePassed,
        expected: expected.stage,
        actual: actualStage ?? "unknown",
        message: stagePassed
            ? undefined
            : `Expected stage "${expected.stage}" but conversation stage was "${actualStage ?? "unknown"}"`,
    });

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
