import { startActiveObservation } from "@langfuse/tracing";
import type { TextCompletionPort } from "../ports/text-completion.types";
import type { LlmTokenUsageContext } from "../token-usage.types";

type LangfuseTracedTextCompletionAdapterParams = {
    readonly inner: TextCompletionPort;
    readonly provider: string;
    readonly model: string;
};

export class LangfuseTracedTextCompletionAdapter implements TextCompletionPort {
    constructor(private readonly params: LangfuseTracedTextCompletionAdapterParams) { }

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> => {
        const operation = context?.operation ?? "chat.text_completion";
        return await startActiveObservation(
            operation,
            async (observation) => {
                observation.update({
                    input: prompt,
                    model: this.params.model,
                    metadata: {
                        provider: this.params.provider,
                        operation,
                        ...(context?.userId ? { userId: context.userId } : {}),
                    },
                });

                try {
                    const output = await this.params.inner.complete(prompt, context);
                    observation.update({ output });
                    return output;
                } catch (error: unknown) {
                    observation.update({
                        output: error instanceof Error ? error.message : String(error),
                        level: "ERROR",
                        statusMessage: error instanceof Error ? error.message : String(error),
                    });
                    throw error;
                }
            },
            { asType: "generation" }
        );
    };
}
