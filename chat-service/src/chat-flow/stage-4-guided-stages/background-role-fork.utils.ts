import type { ChatTurnDecision } from "../api/shared/chat.types";
import { extractClaimedCurrentRole } from "../stage-2-shortcuts/role-conflict/role-conflict.utils";
import {
    isDreamJobPivotMessage,
    isNearTermPivotMessage,
    isUndecidedDirectionMessage,
} from "../stage-1-prepare-context/mode-detection/conversation-mode.pivot.utils";
import { BACKGROUND_ROLE_FORK_STAGE_ID } from "./background-role-fork.consts";

const cleanClaimedRole = (rawRole: string): string =>
    rawRole
        .replace(/\s+in\s+the\s+last\s+\d+\s+years?\b.*$/i, "")
        .replace(/\s+for\s+(?:the\s+)?(?:last\s+)?\d+\s+years?\b.*$/i, "")
        .replace(/\s+and\s+(?:i|my|in)\b.*$/i, "")
        .trim();

const articleForRole = (role: string): "a" | "an" =>
    /^[aeiou]/i.test(role.trim()) ? "an" : "a";

export const buildDirectionForkReply = (role: string): string => {
    const cleaned = cleanClaimedRole(role);
    return `I see that you are ${articleForRole(cleaned)} ${cleaned} — what are you looking for now?`;
};

export const applyBackgroundRoleForkOverride = (
    decision: ChatTurnDecision,
    latestUserMessage: string,
    currentStageId: string | null | undefined,
): ChatTurnDecision => {
    if (currentStageId !== BACKGROUND_ROLE_FORK_STAGE_ID) {
        return decision;
    }
    if (
        isNearTermPivotMessage(latestUserMessage)
        || isDreamJobPivotMessage(latestUserMessage)
        || isUndecidedDirectionMessage(latestUserMessage)
    ) {
        return decision;
    }

    const claimedRole = extractClaimedCurrentRole(latestUserMessage);
    if (!claimedRole) {
        return decision;
    }

    const cleanedRole = cleanClaimedRole(claimedRole);
    if (cleanedRole.length < 3) {
        return decision;
    }

    return {
        ...decision,
        reply: buildDirectionForkReply(cleanedRole),
        shouldAdvanceStage: true,
        shouldSearchJobs: false,
    };
};
