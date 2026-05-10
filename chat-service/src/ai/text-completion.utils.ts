import type { TextCompletionPort } from "./ports/text-completion.types";
import type { ResolvedLlmConfig } from "./llm-config.types";
import { GeminiTextCompletionAdapter } from "./adapters/gemini/gemini-text-completion.adapter";
import { OpenAiTextCompletionAdapter } from "./adapters/openai/openai-text-completion.adapter";
import { HttpCustomTextCompletionAdapter } from "./adapters/custom/http-custom-text-completion.adapter";

export const createTextCompletionPort = (llm: ResolvedLlmConfig): TextCompletionPort => {
    if (llm.provider === "gemini") {
        return new GeminiTextCompletionAdapter(llm.apiKey, llm.model);
    }

    if (llm.provider === "openai") {
        return new OpenAiTextCompletionAdapter(llm.apiKey, llm.model);
    }

    return new HttpCustomTextCompletionAdapter(llm.endpointUrl);
};
