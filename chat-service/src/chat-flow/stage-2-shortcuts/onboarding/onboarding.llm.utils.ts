import type { OnboardingBackground, OnboardingInitialMode } from "../../../routes/conversation/conversation.types";
import { parseJsonObjectFromLlm } from "../../shared/llm/json-response.utils";
import type { OnboardingLlmDecision } from "./onboarding.types";
import { ONBOARDING_DIRECTION_REASK_REPLY, ONBOARDING_PARSE_FALLBACK_REPLY } from "./onboarding.types";

const INTERNAL_LABEL_LEAK_PATTERN =
    /\b(?:NEAR[_\s-]?TERM|DREAM[_\s-]?JOB|GUIDED|FOUND|UNKNOWN)\b|\[[^\]]*(?:NEAR_TERM|DREAMJOB|GUIDED)[^\]]*\]/gi;

export const sanitizeOnboardingUserResponse = (response: string): string => {
    const hadInternalLeak = INTERNAL_LABEL_LEAK_PATTERN.test(response);
    INTERNAL_LABEL_LEAK_PATTERN.lastIndex = 0;
    const withoutLabels = response
        .replace(INTERNAL_LABEL_LEAK_PATTERN, "")
        .replace(/\s*You're now looking to\s*/i, " ")
        .replace(/\s*Which direction would you like to take\??/i, "")
        .replace(/\s{2,}/g, " ")
        .trim();

    if (!hadInternalLeak) {
        return withoutLabels.length > 0 ? withoutLabels : ONBOARDING_PARSE_FALLBACK_REPLY;
    }

    if (withoutLabels.length >= 40) {
        return `${withoutLabels} ${ONBOARDING_DIRECTION_REASK_REPLY}`.replace(/\s{2,}/g, " ").trim();
    }
    return ONBOARDING_DIRECTION_REASK_REPLY;
};

const parseStringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
        : [];

const parseBackgroundStatus = (value: unknown): OnboardingBackground["status"] => {
    if (typeof value !== "string") {
        return "UNKNOWN";
    }
    const normalized = value.trim().toUpperCase();
    if (normalized === "FOUND" || normalized === "NONE" || normalized === "UNKNOWN") {
        return normalized;
    }
    return "UNKNOWN";
};

const parseMode = (value: unknown): OnboardingInitialMode | null => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (normalized === "NEAR_TERM" || normalized === "N" || normalized === "NEXT_JOB") {
        return "NEAR_TERM";
    }
    if (normalized === "DREAMJOB" || normalized === "DREAM_JOB" || normalized === "D") {
        return "DREAMJOB";
    }
    if (normalized === "GUIDED" || normalized === "G" || normalized === "UNCLEAR") {
        return "GUIDED";
    }
    return null;
};

const parseBackground = (value: unknown): OnboardingBackground => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { status: "UNKNOWN" };
    }
    const obj = value as Record<string, unknown>;
    const years = obj.yearsOfExperience;
    return {
        status: parseBackgroundStatus(obj.status),
        role: typeof obj.role === "string" && obj.role.trim().length > 0 ? obj.role.trim() : null,
        yearsOfExperience: typeof years === "number" && Number.isFinite(years) ? years : null,
        companies: parseStringArray(obj.companies),
        technologies: parseStringArray(obj.technologies),
        education: parseStringArray(obj.education),
        summary: typeof obj.summary === "string" && obj.summary.trim().length > 0 ? obj.summary.trim() : null,
    };
};

export const parseOnboardingLlmDecisionFromJson = (rawText: string): OnboardingLlmDecision => {
    const obj = parseJsonObjectFromLlm(rawText);
    if (!obj) {
        throw new Error("Onboarding LLM returned invalid JSON");
    }

    const rawResponse = typeof obj.response === "string" && obj.response.trim().length > 0
        ? obj.response.trim()
        : typeof obj.r === "string" && obj.r.trim().length > 0
            ? obj.r.trim()
            : ONBOARDING_PARSE_FALLBACK_REPLY;

    return {
        response: sanitizeOnboardingUserResponse(rawResponse),
        background: parseBackground(obj.background),
        mode: parseMode(obj.mode),
        advance: obj.advance === true,
    };
};
