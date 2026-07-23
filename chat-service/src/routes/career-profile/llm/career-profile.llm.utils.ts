import { z } from "zod";
import type { TextCompletionPort } from "../../../litellm/text-completion/text-completion.types";
import type { ProfileInput } from "../../conversation/conversation.types";
import {
    PROFILE_INPUT_LLM_OPERATION,
    PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE,
} from "./career-profile.llm.consts";
import type { ProfileInputLlmExtraction } from "./career-profile.llm.types";
import type { CareerProfileSignalUpdate, CareerSignal } from "../career-profile.types";

const stringListSchema = z.array(z.string()).default([]);

export const ProfileInputLlmExtractionSchema = z.object({
    technologies: stringListSchema,
    interests: stringListSchema,
    preferredRoles: stringListSchema,
    softSkills: stringListSchema,
    strengths: stringListSchema,
    motivations: stringListSchema,
    shortTermGoals: stringListSchema,
    longTermGoals: stringListSchema,
    extractedKeywords: stringListSchema,
    locationPreference: z.string().nullable().default(null),
    uncertaintyLevel: z.number().min(0).max(1).nullable().default(null),
});

const toSignal = (
    value: string,
    evidence: string,
    confidence: number
): CareerSignal => ({
    value: value.trim(),
    confidence,
    evidence: [evidence],
    source: "llm_inference",
    updatedAt: new Date(),
});

const normalizeStringList = (values: readonly string[]): string[] =>
    [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];

export const hasUsableProfileInput = (profile?: ProfileInput): profile is ProfileInput => {
    if (!profile) {
        return false;
    }
    return Boolean(
        profile.firstName?.trim() ||
        profile.lastName?.trim() ||
        profile.currentJob?.trim() ||
        profile.cvExcerpt?.trim() ||
        (profile.achievements && profile.achievements.length > 0) ||
        (profile.technologies && profile.technologies.length > 0) ||
        (profile.interests && profile.interests.length > 0) ||
        (profile.githubSkills && profile.githubSkills.length > 0) ||
        (profile.knownSkills && profile.knownSkills.length > 0)
    );
};

export const buildProfileInputInferencePrompt = (profile: ProfileInput): string => {
    const profilePayload = {
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        currentJob: profile.currentJob ?? null,
        achievements: profile.achievements?.map((item) => ({ id: item.id, name: item.name, grade: item.grade })) ?? [],
        technologies: profile.technologies ?? [],
        interests: profile.interests ?? [],
        githubSkills: profile.githubSkills ?? [],
        knownSkills: profile.knownSkills ?? [],
        cvExcerpt: profile.cvExcerpt ?? null,
    };

    return [
        "You extract structured career-profile signals from a user's profile payload.",
        "Return ONLY valid JSON matching this schema:",
        JSON.stringify({
            technologies: ["string"],
            interests: ["string"],
            preferredRoles: ["string"],
            softSkills: ["string"],
            strengths: ["string"],
            motivations: ["string"],
            shortTermGoals: ["string"],
            longTermGoals: ["string"],
            extractedKeywords: ["string"],
            locationPreference: "string or null",
            uncertaintyLevel: "number between 0 and 1, or null",
        }),
        "Rules:",
        "- Infer only what is supported by the profile payload.",
        "- Do not create strings that the user dont say",
        "- Prefer concise canonical labels (e.g. TypeScript, Backend Engineer).",
        "- Do not invent employers, degrees, or roles that are not implied.",
        "- If a field is unknown, use [] or null.",
        "Profile payload:",
        JSON.stringify(profilePayload),
    ].join("\n");
};

const extractJsonObjectText = (rawText: string): string => {
    const trimmed = rawText.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        return fenced[1].trim();
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
        return trimmed.slice(start, end + 1);
    }
    return trimmed;
};

export const parseProfileInputLlmExtraction = (rawText: string): ProfileInputLlmExtraction => {
    const parsed: unknown = JSON.parse(extractJsonObjectText(rawText));
    return ProfileInputLlmExtractionSchema.parse(parsed);
};

export const toCareerProfileSignalUpdateFromLlmExtraction = (
    extraction: ProfileInputLlmExtraction,
    evidence: string
): CareerProfileSignalUpdate => {
    const mapSignals = (
        values: readonly string[],
        confidence: number
    ): CareerSignal[] => normalizeStringList(values).map((value) => toSignal(value, evidence, confidence));

    return {
        technologies: mapSignals(extraction.technologies, PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE.technologies),
        interests: mapSignals(extraction.interests, PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE.interests),
        preferredRoles: mapSignals(extraction.preferredRoles, PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE.preferredRoles),
        softSkills: mapSignals(extraction.softSkills, PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE.softSkills),
        strengths: mapSignals(extraction.strengths, PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE.strengths),
        motivations: mapSignals(extraction.motivations, PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE.motivations),
        shortTermGoals: mapSignals(extraction.shortTermGoals, PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE.shortTermGoals),
        longTermGoals: mapSignals(extraction.longTermGoals, PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE.longTermGoals),
        extractedKeywords: mapSignals(extraction.extractedKeywords, PROFILE_INPUT_LLM_SIGNAL_CONFIDENCE.extractedKeywords),
        ...(extraction.locationPreference ? { locationPreference: extraction.locationPreference } : {}),
        ...(extraction.uncertaintyLevel !== null ? { uncertaintyLevel: extraction.uncertaintyLevel } : {}),
    };
};

export const inferProfileUpdateFromProfileInputWithLlm = async (
    textCompletion: TextCompletionPort,
    userId: string,
    profile: ProfileInput
): Promise<CareerProfileSignalUpdate> => {
    const evidence = [
        profile.currentJob ?? "",
        ...(profile.achievements?.map((item) => item.name) ?? []),
        ...(profile.technologies ?? []),
        ...(profile.interests ?? []),
        ...(profile.githubSkills ?? []),
        ...(profile.knownSkills ?? []),
        profile.cvExcerpt ?? "",
    ]
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .join(" | ");

    try {
        const rawText = await textCompletion.complete(buildProfileInputInferencePrompt(profile), {
            operation: PROFILE_INPUT_LLM_OPERATION,
            userId,
        });
        const extraction = parseProfileInputLlmExtraction(rawText);
        return toCareerProfileSignalUpdateFromLlmExtraction(extraction, evidence || "profile_input");
    } catch {
        return {};
    }
};
