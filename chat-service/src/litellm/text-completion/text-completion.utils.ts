import type { TextCompletionPort } from "./text-completion.types";
import type { ResolvedLlmConfig } from "../config/litellm-config.types";
import type { LlmTokenUsageRecorder } from "../../ai/token-usage/token-usage.types";
import { LiteLlmTextCompletionAdapter } from "./litellm-text-completion.adapter";

export const createTextCompletionPort = (
    llm: ResolvedLlmConfig,
    tokenUsageRecorder?: LlmTokenUsageRecorder
): TextCompletionPort =>
    new LiteLlmTextCompletionAdapter(llm.endpointUrl, llm.model, llm.apiKey, tokenUsageRecorder);
