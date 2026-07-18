import type { TextCompletionPort } from "../../../litellm/text-completion/text-completion.types";
import type { UserAchievement } from "../../api/shared/chat.model";
import type { Conversation } from "../../../routes/conversation/conversation.model";
import { buildModeDetectionPrompt } from "../../shared/llm/chat.prompt.utils";
import { DEFAULT_CONVERSATION_MODE } from "./conversation-mode.consts";
import type { ConversationModeDetectionResult } from "./conversation-mode.types";
import { isConversationMode } from "./conversation-mode.utils";

export const detectConversationMode = async (
    textCompletion: TextCompletionPort,
    conversation: Conversation,
    latestUserMessage: string,
    userAchievements: readonly UserAchievement[],
    userAccountContext?: string
): Promise<ConversationModeDetectionResult> => {
    const rawText = await textCompletion.complete(
        buildModeDetectionPrompt(conversation, latestUserMessage, userAchievements, userAccountContext),
        { operation: "chat.decision", userId: conversation.userId }
    );

    try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === "object" && isConversationMode(parsed.mode)) {
            return {
                mode: parsed.mode,
                fastSearchQuery: typeof parsed.fastSearchQuery === "string" ? parsed.fastSearchQuery : undefined,
            };
        }
        return { mode: DEFAULT_CONVERSATION_MODE };
    } catch {
        return { mode: DEFAULT_CONVERSATION_MODE };
    }
};
