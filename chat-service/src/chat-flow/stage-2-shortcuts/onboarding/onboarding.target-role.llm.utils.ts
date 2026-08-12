import { parseJsonObjectFromLlm } from "../../shared/llm/json-response.utils";
import {
    buildDifferentRoleDiscoveryReply,
    normalizeTargetRole,
    parseTargetDiscoveryFacts,
} from "./onboarding.target-role.utils";
import type {
    TargetRoleDecision,
    TargetRoleGroundingDecision,
    TargetRoleOption,
    TargetRoleOptionsReviewDecision,
} from "./onboarding.target-role.types";

const MAX_ROLE_REASON_CHARS = 240;
const INVALID_ROLE_TITLE_PATTERN = /[\[\]{}<>]|\bsearchable\s+role\b|\b(?:role|option)\s*\d+\b/i;
const GENERIC_ROLE_TITLES = new Set(["role", "job", "position", "different role", "new role", "career"]);
const GROUNDING_DECISION_KINDS = [
    "GROUNDED_ROLE",
    "GROUNDED_SUGGESTION",
    "GROUNDED_CONFIRMATION",
    "NEEDS_CLARIFICATION",
] as const;

const normalizeEvidence = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapGroundingDecisionObject = (object: Record<string, unknown>): Record<string, unknown> => {
    if (typeof object.kind === "string") {
        return object;
    }
    const wrappedDecisions = GROUNDING_DECISION_KINDS.flatMap((expectedKind) => {
        const wrapped = object[expectedKind];
        if (!isUnknownRecord(wrapped) || typeof wrapped.kind !== "string") {
            return [];
        }
        const actualKind = wrapped.kind.trim().toUpperCase().replace(/[\s-]+/g, "_");
        return actualKind === expectedKind ? [wrapped] : [];
    });
    return wrappedDecisions[0] ?? object;
};

const parseExactEvidenceQuote = (value: unknown, latestUserMessage: string): string | null => {
    if (typeof value !== "string") {
        return null;
    }
    const evidenceQuote = value.trim();
    const normalizedEvidence = normalizeEvidence(evidenceQuote);
    const normalizedMessage = normalizeEvidence(latestUserMessage);
    return normalizedEvidence.length > 0 && normalizedMessage.includes(normalizedEvidence) ? evidenceQuote : null;
};

const normalizeRoleTitle = (value: unknown): string | null => {
    if (typeof value !== "string") {
        return null;
    }
    const title = normalizeTargetRole(value);
    if (!title || INVALID_ROLE_TITLE_PATTERN.test(title) || GENERIC_ROLE_TITLES.has(title.toLowerCase())) {
        return null;
    }
    return title;
};

const parseRoleList = (value: unknown): readonly TargetRoleOption[] | null => {
    if (!Array.isArray(value)) {
        return null;
    }
    const parsedRoles = value.flatMap((item): TargetRoleOption[] => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
            return [];
        }
        const role = item as Record<string, unknown>;
        const title = normalizeRoleTitle(role.title);
        const reason = typeof role.reason === "string"
            ? role.reason.trim().slice(0, MAX_ROLE_REASON_CHARS)
            : "";
        return title && reason.length >= 8 && !INVALID_ROLE_TITLE_PATTERN.test(reason)
            ? [{ title, reason }]
            : [];
    });
    const roles = [...new Map(parsedRoles.map((role) => [role.title.toLowerCase(), role])).values()];
    return roles.length >= 3 && roles.length <= 5 ? roles : null;
};

export const parseTargetRoleDecision = (rawText: string, latestUserMessage?: string): TargetRoleDecision | null => {
    const object = parseJsonObjectFromLlm(rawText);
    if (!object || typeof object.status !== "string") {
        return null;
    }

    const status = object.status.trim().toUpperCase().replace(/[\s-]+/g, "_");
    const discoveryFacts = parseTargetDiscoveryFacts(object.discoveryFacts);
    if (status === "READY") {
        const targetRole = normalizeRoleTitle(object.targetRole);
        const hasRequiredEvidence = latestUserMessage === undefined
            || parseExactEvidenceQuote(object.evidenceQuote, latestUserMessage) !== null;
        return targetRole && hasRequiredEvidence ? { status: "READY", targetRole, discoveryFacts } : null;
    }

    if (
        status === "NEEDS_CLARIFICATION"
        && typeof object.question === "string"
        && typeof object.subject === "string"
    ) {
        const question = object.question.trim();
        const subject = object.subject.trim().slice(0, 80);
        const validatedQuestion = buildDifferentRoleDiscoveryReply(question);
        return validatedQuestion === question && subject.length >= 2
            ? { status: "NEEDS_CLARIFICATION", question, subject, discoveryFacts }
            : null;
    }

    if (status === "ROLE_OPTIONS" && typeof object.summary === "string") {
        const summary = object.summary.trim().slice(0, 400);
        const roles = parseRoleList(object.roles);
        return roles && summary.length > 0 && !INVALID_ROLE_TITLE_PATTERN.test(summary)
            ? { status: "ROLE_OPTIONS", summary, roles, discoveryFacts }
            : null;
    }

    return null;
};

export const parseTargetRoleOptionsReviewDecision = (
    rawText: string,
    latestUserMessage: string,
): TargetRoleOptionsReviewDecision | null => {
    const object = parseJsonObjectFromLlm(rawText);
    if (!object || typeof object.verdict !== "string") {
        return null;
    }
    const verdict = object.verdict.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (verdict === "KEEP_OPTIONS") {
        return { verdict: "KEEP_OPTIONS" };
    }
    if (verdict !== "READY") {
        return null;
    }
    const targetRole = normalizeRoleTitle(object.targetRole);
    const evidenceQuote = parseExactEvidenceQuote(object.evidenceQuote, latestUserMessage);
    return targetRole && evidenceQuote ? { verdict: "READY", targetRole, evidenceQuote } : null;
};

export const parseTargetRoleGroundingDecision = (
    rawText: string,
    candidateRole: string,
    latestUserMessage: string,
    suggestedRoles: readonly string[] | null | undefined = [],
    previousAssistantMessage?: string,
): TargetRoleGroundingDecision | null => {
    const parsedObject = parseJsonObjectFromLlm(rawText);
    if (!parsedObject) {
        return null;
    }
    const object = unwrapGroundingDecisionObject(parsedObject);
    if (typeof object.kind !== "string") {
        return null;
    }

    const kind = object.kind.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (
        kind === "GROUNDED_ROLE"
        && typeof object.evidenceQuote === "string"
        && typeof object.normalizedTargetRole === "string"
    ) {
        const evidenceQuote = object.evidenceQuote.trim();
        const normalizedEvidence = normalizeEvidence(evidenceQuote);
        const normalizedCandidate = normalizeEvidence(candidateRole);
        const normalizedMessage = normalizeEvidence(latestUserMessage);
        const normalizedTargetRole = normalizeTargetRole(object.normalizedTargetRole);
        const isExactUserEvidence = normalizedEvidence.length > 0
            && normalizedMessage.includes(normalizedEvidence)
            && normalizedEvidence.includes(normalizedCandidate);
        return isExactUserEvidence && normalizedTargetRole
            ? { kind: "GROUNDED_ROLE", evidenceQuote, normalizedTargetRole }
            : null;
    }

    if (kind === "GROUNDED_SUGGESTION" && typeof object.evidenceQuote === "string") {
        const evidenceQuote = object.evidenceQuote.trim();
        const normalizedEvidence = normalizeEvidence(evidenceQuote);
        const normalizedMessage = normalizeEvidence(latestUserMessage);
        const candidateWasSuggested = (suggestedRoles ?? []).some(
            (role) => normalizeEvidence(role) === normalizeEvidence(candidateRole),
        );
        const isExactUserEvidence = normalizedEvidence.length > 0
            && normalizedMessage.includes(normalizedEvidence);
        return candidateWasSuggested && isExactUserEvidence
            ? { kind: "GROUNDED_SUGGESTION", evidenceQuote }
            : null;
    }

    if (
        kind === "GROUNDED_CONFIRMATION"
        && typeof object.evidenceQuote === "string"
        && typeof object.normalizedTargetRole === "string"
    ) {
        const evidenceQuote = object.evidenceQuote.trim();
        const normalizedEvidence = normalizeEvidence(evidenceQuote);
        const normalizedMessage = normalizeEvidence(latestUserMessage);
        const normalizedCandidate = normalizeEvidence(candidateRole);
        const normalizedPreviousAssistantMessage = normalizeEvidence(previousAssistantMessage ?? "");
        const normalizedTargetRole = normalizeTargetRole(object.normalizedTargetRole);
        const isExactUserEvidence = normalizedEvidence.length > 0
            && normalizedMessage.includes(normalizedEvidence);
        const candidateWasAskedForConfirmation = normalizedCandidate.length > 0
            && normalizedPreviousAssistantMessage.includes(normalizedCandidate);
        return isExactUserEvidence && candidateWasAskedForConfirmation && normalizedTargetRole
            ? { kind: "GROUNDED_CONFIRMATION", evidenceQuote, normalizedTargetRole }
            : null;
    }

    if (kind === "NEEDS_CLARIFICATION" && typeof object.question === "string") {
        const question = object.question.trim();
        const validatedQuestion = buildDifferentRoleDiscoveryReply(question);
        return validatedQuestion === question
            ? { kind: "NEEDS_CLARIFICATION", question }
            : null;
    }

    return null;
};
