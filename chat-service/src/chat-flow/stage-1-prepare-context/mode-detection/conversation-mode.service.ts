import type { TextCompletionPort } from "../../../litellm/text-completion/text-completion.types";
import type { Conversation } from "../../../routes/conversation/conversation.model";
import { buildConversationModeDetectionPrompt } from "./conversation-mode.prompt.utils";
import { DEFAULT_MODE_DETECTION_RESULT } from "./conversation-mode.consts";
import type { ConversationModeDetectionResult } from "./conversation-mode.types";
import { parseConversationModeDetectionResult } from "./conversation-mode.utils";

export const detectConversationMode = async (
    textCompletion: TextCompletionPort,
    conversation: Conversation,
    latestUserMessage: string,
    userAccountContext?: string
): Promise<ConversationModeDetectionResult> => {
    const rawText = await textCompletion.complete(
        buildConversationModeDetectionPrompt(conversation, latestUserMessage, userAccountContext),
        { operation: "chat.decision", userId: conversation.userId }
    );

    return parseConversationModeDetectionResult(rawText) ?? DEFAULT_MODE_DETECTION_RESULT;
};
