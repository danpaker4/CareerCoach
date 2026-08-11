import {
    QA_ROLE_MARKERS,
    QA_STALE_SKILL_MARKERS,
    SOFTWARE_ROLE_MARKERS,
} from "./role-conflict.consts";

const normalizeRoleText = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ").replace(/\s+/g, " ").trim();

const containsAnyMarker = (text: string, markers: readonly string[]): boolean => {
    const normalized = normalizeRoleText(text);
    return markers.some((marker) => normalized.includes(marker));
};

const cleanExtractedRole = (captured: string): string =>
    captured
        .replace(/\s+in\s+the\s+last\s+\d+\s+years?\b.*$/i, "")
        .replace(/\s+for\s+(?:the\s+)?(?:last\s+)?\d+\s+years?\b.*$/i, "")
        .replace(/\s+and\s+(?:i|my|in)\b.*$/i, "")
        .trim();

export const extractClaimedCurrentRole = (message: string): string | undefined => {
    const trimmed = message.trim();
    if (trimmed.length === 0) return undefined;

    const patterns: readonly RegExp[] = [
        /\bin\s+the\s+last\s+\d+\s+years?\s+i(?:'?m| am)\s+(?:(?:a|an)\s+)?([^.,!?\n]{3,80})/i,
        /\bi(?:'?m| am)\s+(?:(?:a|an)\s+)?([^.,!?\n]{3,80})/i,
        /\bi(?:'?ve| have)\s+been\s+(?:(?:a|an)\s+)?([^.,!?\n]{3,80})/i,
        /\bi\s+work\s+as\s+(?:(?:a|an)\s+)?([^.,!?\n]{3,80})/i,
        /\bmy\s+(?:current\s+)?(?:job|role|title)\s+is\s+([^.,!?\n]{3,80})/i,
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        const captured = match?.[1]?.trim();
        if (!captured) continue;
        const withoutTenure = cleanExtractedRole(captured);
        if (withoutTenure.length >= 3) {
            return withoutTenure;
        }
    }
    return undefined;
};

export const rolesConflict = (cvRole: string, chatRole: string): boolean => {
    const cv = normalizeRoleText(cvRole);
    const chat = normalizeRoleText(chatRole);
    if (cv.length === 0 || chat.length === 0) return false;
    if (cv === chat || cv.includes(chat) || chat.includes(cv)) return false;

    const cvIsQa = containsAnyMarker(cv, QA_ROLE_MARKERS);
    const chatIsSoftware = containsAnyMarker(chat, SOFTWARE_ROLE_MARKERS);
    const chatIsQa = containsAnyMarker(chat, QA_ROLE_MARKERS);
    const cvIsSoftware = containsAnyMarker(cv, SOFTWARE_ROLE_MARKERS);

    if ((cvIsQa && chatIsSoftware) || (cvIsSoftware && chatIsQa)) {
        return true;
    }

    const cvTokens = new Set(cv.split(" ").filter((token) => token.length > 2));
    const chatTokens = chat.split(" ").filter((token) => token.length > 2);
    const overlap = chatTokens.filter((token) => cvTokens.has(token)).length;
    return overlap === 0;
};

export const isChatRolePreferredResolution = (message: string, chatClaimedRole: string): boolean => {
    const normalized = message.trim().toLowerCase();
    if (normalized.length === 0) return false;
    if (/\b(?:chat|message|what i said|software|developer|engineer)\b/.test(normalized)
        && !/\b(?:cv|resume|qa)\b/.test(normalized)) {
        if (containsAnyMarker(normalized, SOFTWARE_ROLE_MARKERS) || /\bsoftware\b|\bdeveloper\b/.test(normalized)) {
            return true;
        }
    }
    if (normalizeRoleText(chatClaimedRole).length > 0
        && normalized.includes(normalizeRoleText(chatClaimedRole).slice(0, 12))) {
        return true;
    }
    if (/\bnot\s+(?:a\s+)?qa\b/.test(normalized) || /\b(?:ignore|wrong)\s+(?:the\s+)?cv\b/.test(normalized)) {
        return true;
    }
    return false;
};

export const isCvRolePreferredResolution = (message: string, cvRole: string): boolean => {
    const normalized = message.trim().toLowerCase();
    if (normalized.length === 0) return false;
    if (/\b(?:cv|resume)\b/.test(normalized) && !/\bnot\b.{0,12}\b(?:cv|resume)\b/.test(normalized)) {
        return true;
    }
    if (containsAnyMarker(normalized, QA_ROLE_MARKERS) && !/\bnot\s+(?:a\s+)?qa\b/.test(normalized)) {
        return true;
    }
    const cvNorm = normalizeRoleText(cvRole);
    if (cvNorm.length > 0 && normalized.includes(cvNorm.slice(0, Math.min(12, cvNorm.length)))) {
        return true;
    }
    return false;
};

export const isQaLinkedText = (value: string): boolean =>
    containsAnyMarker(value, [...QA_ROLE_MARKERS, ...QA_STALE_SKILL_MARKERS]);

export const filterOutQaLinkedSkills = (skills: readonly string[]): string[] =>
    skills.filter((skill) => !isQaLinkedText(skill));

export const filterOutQaLinkedAchievements = <T extends { name: string }>(
    achievements: readonly T[],
): T[] => achievements.filter((achievement) => !isQaLinkedText(achievement.name));
