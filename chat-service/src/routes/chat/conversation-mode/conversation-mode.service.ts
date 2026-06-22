import type { TextCompletionPort } from "../../../ai/ports/text-completion.types";
import type { UserAchievement } from "../chat.model";
import type { Conversation } from "../../conversation/conversation.model";
import { buildModeDetectionPrompt } from "../llm/chat.prompt.utils";
import { DEFAULT_CONVERSATION_MODE } from "./conversation-mode.consts";
import type { ConversationModeDetectionResult } from "./conversation-mode.types";
import { isConversationMode } from "./conversation-mode.utils";

export class ConversationModeService {
    constructor(private readonly textCompletion: TextCompletionPort) {}

    detectConversationMode = async (
        conversation: Conversation,
        latestUserMessage: string,
        userAchievements: readonly UserAchievement[],
        userAccountContext?: string
    ): Promise<ConversationModeDetectionResult> => {
        const rawText = await this.textCompletion.complete(
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
}
