import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { TextCompletionPort } from "../../../litellm/text-completion/text-completion.types";
import type { ChatLlmObserver } from "../../shared/llm/chat.llm.types";

export type TargetRoleDecision =
    | { readonly status: "READY"; readonly targetRole: string }
    | { readonly status: "NEEDS_CLARIFICATION"; readonly question: string }
    | { readonly status: "ROLE_OPTIONS"; readonly response: string; readonly roles: readonly string[] }
    | { readonly status: "EXPLORE"; readonly response: string; readonly searchQuery: string };

export type TargetRoleGroundingDecision =
    | { readonly kind: "GROUNDED_ROLE"; readonly evidenceQuote: string }
    | { readonly kind: "GROUNDED_SUGGESTION"; readonly evidenceQuote: string }
    | { readonly kind: "NEEDS_CLARIFICATION"; readonly question: string };

export type ResolveTargetRoleDecisionParams = {
    readonly textCompletion: TextCompletionPort;
    readonly conversation: Conversation;
    readonly latestUserMessage: string;
    readonly userId: string;
    readonly conversationId: string;
    readonly observer?: ChatLlmObserver;
};
