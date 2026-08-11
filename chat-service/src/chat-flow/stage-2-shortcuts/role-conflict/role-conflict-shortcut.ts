import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { isDreamJobPivotMessage } from "../../stage-1-prepare-context/mode-detection/conversation-mode.pivot.utils";
import { readString } from "../../stage-1-prepare-context/user-context/profile-field.utils";
import {
    extractClaimedCurrentRole,
    isChatRolePreferredResolution,
    isCvRolePreferredResolution,
    rolesConflict,
} from "./role-conflict.utils";

const resolveCvRole = (ctx: SendMessagePreparedContext): string | null => {
    const fromProfile = readString(ctx.profile?.currentJob);
    if (fromProfile) return fromProfile;
    const match = ctx.userAccountContext.match(/Current role \/ headline:\s*(.+)/i);
    const fromContext = match?.[1]?.trim();
    return fromContext && fromContext.length > 0 ? fromContext : null;
};

export const tryRoleConflictShortcutResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
): Promise<ChatMessageResponse | null> => {
    const existing = ctx.conversationAfterUserMessage.roleConflictFlow;

    if (existing?.awaitingResolution === true) {
        if (isDreamJobPivotMessage(ctx.normalizedMessage)) {
            return null;
        }

        const prefersChat = isChatRolePreferredResolution(ctx.normalizedMessage, existing.chatClaimedRole);
        const prefersCv = isCvRolePreferredResolution(ctx.normalizedMessage, existing.cvRole);

        if (prefersChat && !prefersCv) {
            const applied = await deps.externalService.applyChatRoleOverride(ctx.userId, {
                currentJob: existing.chatClaimedRole,
                removeQaLinkedSkills: true,
            });
            await deps.conversationService.updateRoleConflictFlow(ctx.userId, ctx.conversationId, {
                ...existing,
                awaitingResolution: false,
                resolved: "chat",
            });
            const reply = applied
                ? `Got it — I'll treat you as a ${existing.chatClaimedRole} and drop the conflicting QA details from your profile.`
                : `Got it — I'll treat you as a ${existing.chatClaimedRole} going forward.`;
            await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
            return { reply, mode: ctx.modeDetection.mode, confidenceSummary: ctx.confidenceSummary };
        }

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

        const retry = `Just to confirm: are you currently a ${existing.chatClaimedRole}, or should I keep the CV role (${existing.cvRole})?`;
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, retry);
        return { reply: retry, mode: ctx.modeDetection.mode, confidenceSummary: ctx.confidenceSummary };
    }

    if (existing?.resolved || isDreamJobPivotMessage(ctx.normalizedMessage)) {
        return null;
    }

    const claimedRole = extractClaimedCurrentRole(ctx.normalizedMessage);
    const cvRole = resolveCvRole(ctx);
    if (!claimedRole || !cvRole || !rolesConflict(cvRole, claimedRole)) {
        return null;
    }

    await deps.conversationService.updateRoleConflictFlow(ctx.userId, ctx.conversationId, {
        awaitingResolution: true,
        chatClaimedRole: claimedRole,
        cvRole,
    });
    const reply = `Your profile lists you as ${cvRole}, but you said you're a ${claimedRole}. Which one should I use going forward?`;
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return { reply, mode: ctx.modeDetection.mode, confidenceSummary: ctx.confidenceSummary };
};
