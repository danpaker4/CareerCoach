import type { UserAchievementResponse } from "../chat/chat.types";
import { EXPERIENCE_HINTS } from "./chat.external.consts";

export const toAchievementFromMessage = (message: string): UserAchievementResponse | null => {
    const normalized = message.trim().replace(/\s+/g, " ");
    if (normalized.length < 20) {
        return null;
    }

    const lowered = normalized.toLowerCase();
    const hasExperienceSignal = EXPERIENCE_HINTS.some((hint) => lowered.includes(hint));
    if (!hasExperienceSignal) {
        return null;
    }

    const name = normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
    return {
        id: crypto.randomUUID(),
        name,
        grade: 70,
    };
};
