import type { TextCompletionPort } from "../../ports/text-completion.types";
import type { LlmTokenUsageContext, LlmTokenUsageRecorder } from "../../token-usage.types";
import { recordLlmTokenUsage, toLlmErrorMessage } from "../../token-usage.utils";
import { withSpan } from "../../../observability/tracing";
import { DIFY_CHAT_MESSAGES_PATH, DIFY_DEFAULT_USER_ID } from "./http-dify-text-completion.consts";
import { formatDifyErrorMessage, readDifyChatMessageResponse } from "./http-dify-text-completion.utils";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

export class HttpDifyTextCompletionAdapter implements TextCompletionPort {
    private readonly chatMessagesUrl: string;

    constructor(
        endpointUrl: string,
        private readonly apiKey: string,
        private readonly tokenUsageRecorder?: LlmTokenUsageRecorder
    ) {
        this.chatMessagesUrl = `${trimTrailingSlashes(endpointUrl)}${DIFY_CHAT_MESSAGES_PATH}`;
    }

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> =>
        await withSpan("llm.complete", {
            "llm.provider": "dify",
            "llm.model": "dify",
            "llm.operation": context?.operation ?? "chat.text_completion",
            ...(context?.userId ? { "enduser.id": context.userId } : {}),
        }, async (span) => {
            console.info(`[LLM] Sending request provider=dify endpoint=${this.chatMessagesUrl}`);
            try {
                const response = await fetch(this.chatMessagesUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        inputs: {},
                        query: prompt,
                        response_mode: "blocking",
                        user: context?.userId ?? DIFY_DEFAULT_USER_ID,
                    }),
                });

                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(`Dify completion failed: ${formatDifyErrorMessage(payload, response.statusText)}`);
                }

                const parsed = readDifyChatMessageResponse(payload);
                if (!parsed) {
                    throw new Error("Dify returned invalid or empty answer");
                }

                span.setAttributes({
                    "llm.request.status": "success",
                    "llm.usage.prompt_tokens": parsed.usage?.promptTokens ?? 0,
                    "llm.usage.completion_tokens": parsed.usage?.completionTokens ?? 0,
                    "llm.usage.total_tokens": parsed.usage?.totalTokens ?? 0,
                });
                await recordLlmTokenUsage(this.tokenUsageRecorder, {
                    sourceService: "chat-service",
                    operation: context?.operation ?? "chat.text_completion",
                    userId: context?.userId,
                    provider: "dify",
                    model: "dify",
                    usage: parsed.usage,
                    requestStatus: "success",
                });
                return parsed.answer;
            } catch (error: unknown) {
                span.setAttribute("llm.request.status", "error");
                await recordLlmTokenUsage(this.tokenUsageRecorder, {
                    sourceService: "chat-service",
                    operation: context?.operation ?? "chat.text_completion",
                    userId: context?.userId,
                    provider: "dify",
                    model: "dify",
                    usage: null,
                    requestStatus: "error",
                    errorMessage: toLlmErrorMessage(error),
                });
                throw error;
            }
        });
}
