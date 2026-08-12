import { parseJsonObjectFromLlm } from "../../shared/llm/json-response.utils";
import { buildDifferentRoleDiscoveryReply, normalizeTargetRole } from "./onboarding.target-role.utils";
import type { TargetRoleDecision, TargetRoleGroundingDecision } from "./onboarding.target-role.types";

const normalizeEvidence = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const parseRoleList = (value: unknown): readonly string[] | null => {
    if (!Array.isArray(value)) {
        return null;
    }
    const roles = [...new Set(value
        .filter((item): item is string => typeof item === "string")
        .map((item) => normalizeTargetRole(item))
        .filter((item): item is string => item !== null))];
    return roles.length >= 3 && roles.length <= 5 ? roles : null;
};

export const parseTargetRoleDecision = (rawText: string): TargetRoleDecision | null => {
    const object = parseJsonObjectFromLlm(rawText);
    if (!object || typeof object.status !== "string") {
        return null;
    }

    const status = object.status.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (status === "READY") {
        const targetRole = typeof object.targetRole === "string"
            ? normalizeTargetRole(object.targetRole)
            : null;
        return targetRole ? { status: "READY", targetRole } : null;
    }

    if (status === "NEEDS_CLARIFICATION" && typeof object.question === "string") {
        const question = object.question.trim();
        const validatedQuestion = buildDifferentRoleDiscoveryReply(question);
        return validatedQuestion === question
            ? { status: "NEEDS_CLARIFICATION", question }
            : null;
    }

    if (status === "ROLE_OPTIONS" && typeof object.response === "string") {
        const response = object.response.trim();
        const roles = parseRoleList(object.roles);
        const validatedResponse = buildDifferentRoleDiscoveryReply(response);
        return roles && validatedResponse === response
            ? { status: "ROLE_OPTIONS", response, roles }
            : null;
    }

    if (status === "EXPLORE") {
        const roles = parseRoleList(object.roles);
        const providedQuery = typeof object.searchQuery === "string" ? object.searchQuery.trim() : null;
        const searchQuery = roles?.join(" ") ?? providedQuery;
        const modelResponse = typeof object.response === "string" ? object.response.trim() : "";
        const response = modelResponse || (roles
            ? `I'll show exploratory matches across ${roles.join(", ")}.`
            : "");
        return response.length > 0 && searchQuery && searchQuery.length >= 3 && searchQuery.length <= 200
            ? { status: "EXPLORE", response, searchQuery }
            : null;
    }

    return null;
};

export const parseTargetRoleGroundingDecision = (
    rawText: string,
    candidateRole: string,
    latestUserMessage: string,
    suggestedRoles: readonly string[] = [],
): TargetRoleGroundingDecision | null => {
    const object = parseJsonObjectFromLlm(rawText);
    if (!object || typeof object.kind !== "string") {
        return null;
    }

    const kind = object.kind.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (kind === "GROUNDED_ROLE" && typeof object.evidenceQuote === "string") {
        const evidenceQuote = object.evidenceQuote.trim();
        const normalizedEvidence = normalizeEvidence(evidenceQuote);
        const normalizedCandidate = normalizeEvidence(candidateRole);
        const normalizedMessage = normalizeEvidence(latestUserMessage);
        const isExactUserEvidence = normalizedEvidence.length > 0
            && normalizedMessage.includes(normalizedEvidence)
            && normalizedEvidence.includes(normalizedCandidate);
        return isExactUserEvidence ? { kind: "GROUNDED_ROLE", evidenceQuote } : null;
    }

    if (kind === "GROUNDED_SUGGESTION" && typeof object.evidenceQuote === "string") {
        const evidenceQuote = object.evidenceQuote.trim();
        const normalizedEvidence = normalizeEvidence(evidenceQuote);
        const normalizedMessage = normalizeEvidence(latestUserMessage);
        const candidateWasSuggested = suggestedRoles.some(
            (role) => normalizeEvidence(role) === normalizeEvidence(candidateRole),
        );
        const isExactUserEvidence = normalizedEvidence.length > 0
            && normalizedMessage.includes(normalizedEvidence);
        return candidateWasSuggested && isExactUserEvidence
            ? { kind: "GROUNDED_SUGGESTION", evidenceQuote }
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
