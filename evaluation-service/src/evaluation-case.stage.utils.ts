import { CONVERSATION_STAGE_IDS, type ConversationStageId } from "./evaluation-case.stage.consts";

const LEGACY_STAGE_MAP: Readonly<Record<string, ConversationStageId>> = {
    career_discovery: "achievements",
};

export const isConversationStageId = (value: string): value is ConversationStageId =>
    (CONVERSATION_STAGE_IDS as readonly string[]).includes(value);

export const normalizeEvaluationStage = (stage: string): ConversationStageId | null => {
    const trimmed = stage.trim();
    if (isConversationStageId(trimmed)) {
        return trimmed;
    }

    const legacy = LEGACY_STAGE_MAP[trimmed.toLowerCase()];
    return legacy ?? null;
};
