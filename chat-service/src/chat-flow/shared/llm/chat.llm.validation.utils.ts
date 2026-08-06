import type { ZodType } from "zod";

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const logLlmParseFailure = (operation: string, rawText: string, error: unknown): void => {
    console.warn(
        `[CHAT][LLM_PARSE_FAILURE] operation=${operation} rawChars=${rawText.length} error=${JSON.stringify(toErrorMessage(error))}`
    );
};

export const parseLlmJsonWithSchema = <Result>(
    operation: string,
    rawText: string,
    schema: ZodType<Result>
): Result | null => {
    try {
        const parsed: unknown = JSON.parse(rawText);
        return schema.parse(parsed);
    } catch (error: unknown) {
        logLlmParseFailure(operation, rawText, error);
        return null;
    }
};
