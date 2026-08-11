import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { isCvRolePreferredResolution } from "./role-conflict.utils";

export const tryRoleConflictShortcutResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
): Promise<ChatMessageResponse | null> => {
    const existing = ctx.conversationAfterUserMessage.roleConflictFlow;

    if (existing?.awaitingResolution === true) {
        const prefersCv = isCvRolePreferredResolution(ctx.normalizedMessage, existing.cvRole);
        if (prefersCv) {
            await deps.conversationService.updateRoleConflictFlow(ctx.userId, ctx.conversationId, {
                ...existing,
                awaitingResolution: false,
                resolved: "cv",
            });
            const reply = `Thanks for clarifying — I'll keep your CV role as ${existing.cvRole}.`;
            await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
            return { reply, mode: ctx.modeDetection.mode, confidenceSummary: ctx.confidenceSummary };
        }

        await deps.conversationService.updateRoleConflictFlow(ctx.userId, ctx.conversationId, {
            ...existing,
            awaitingResolution: false,
            resolved: "chat",
        });
    }

    return null;
};
