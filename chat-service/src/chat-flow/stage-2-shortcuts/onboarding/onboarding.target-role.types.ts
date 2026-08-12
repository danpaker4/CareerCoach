import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { TextCompletionPort } from "../../../litellm/text-completion/text-completion.types";
import type { ChatLlmObserver } from "../../shared/llm/chat.llm.types";

export type TargetRoleOption = {
    readonly title: string;
    readonly reason: string;
};

type TargetRoleDecisionBase = {
    readonly discoveryFacts: Readonly<Record<string, string>>;
};

export type TargetRoleDecision = TargetRoleDecisionBase & (
    | { readonly status: "READY"; readonly targetRole: string }
    | { readonly status: "NEEDS_CLARIFICATION"; readonly question: string; readonly subject: string }
    | { readonly status: "ROLE_OPTIONS"; readonly summary: string; readonly roles: readonly TargetRoleOption[] }
);

export type TargetRoleGroundingDecision =
    | { readonly kind: "GROUNDED_ROLE"; readonly evidenceQuote: string; readonly normalizedTargetRole: string }
    | { readonly kind: "GROUNDED_SUGGESTION"; readonly evidenceQuote: string }
    | { readonly kind: "GROUNDED_CONFIRMATION"; readonly evidenceQuote: string; readonly normalizedTargetRole: string }
    | { readonly kind: "NEEDS_CLARIFICATION"; readonly question: string };

export type ResolveTargetRoleDecisionParams = {
    readonly textCompletion: TextCompletionPort;
    readonly conversation: Conversation;
    readonly latestUserMessage: string;
    readonly userAccountContext: string;
    readonly userId: string;
    readonly conversationId: string;
    readonly observer?: ChatLlmObserver;
};
