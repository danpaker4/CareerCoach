import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { isAffirmativeConfirmation, isNegativeConfirmation } from "../dream-job/chat.dream-job.utils";
import {
    buildKeywordsFromTitle,
    buildWishlistDetailsPrompt,
    extractProposedWishlistTitle,
    isWishlistDecline,
    isWishlistSaveConfirmation,
    parseWishlistDetailsFromJson,
    wasWishlistSavePromptLast,
    type WishlistDetails,
} from "./chat.wishlist.utils";
import { WantedJobService } from "./wanted-job.service";

const extractWishlistDetails = async (
    deps: ChatFlowDeps,
    message: string,
    proposedTitle: string,
    userId: string
): Promise<WishlistDetails> => {
    const rawText = await deps.textCompletion.complete(
        buildWishlistDetailsPrompt(message, proposedTitle),
        { operation: "chat.offer_job", userId }
    );
    try {
        return parseWishlistDetailsFromJson(rawText, proposedTitle);
    } catch {
        return { jobTitle: proposedTitle, seniority: "", location: "", company: "" };
    }
};

export const saveWishlistFromMessage = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    proposedTitle: string
): Promise<ChatMessageResponse> => {
    const mode = ctx.modeDetection.mode;
    const details = await extractWishlistDetails(deps, ctx.normalizedMessage, proposedTitle, ctx.userId);
    const title = details.jobTitle.trim() || proposedTitle;
    if (!title) {
        const reply = "Tell me the role title and I'll add it to your wishlist.";
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
        return { reply, mode, confidenceSummary: ctx.confidenceSummary };
    }

    const keywords = Array.from(
        new Set([
            ...buildKeywordsFromTitle(title),
            ...(details.company ? details.company.toLowerCase().split(/\s+/) : []),
        ])
    );
    const wantedJobService = new WantedJobService(deps.jobServiceBaseUrl);
    const saveResult = await wantedJobService.create({
        userId: ctx.userId,
        jobTitle: title,
        keywords,
        rawText: ctx.normalizedMessage,
        seniority: details.seniority || undefined,
        location: details.location || undefined,
    });
    console.info(
        `[CHAT][WISHLIST] userId=${ctx.userId} action=save title="${title}" seniority=${details.seniority || "-"} location=${details.location || "-"} company=${details.company || "-"} status=${saveResult.status}`
    );
    if (saveResult.status === "error") {
        const reply = `I couldn't save "${title}" just now — want me to try again?`;
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
        return { reply, mode, confidenceSummary: ctx.confidenceSummary };
    }

    const detailParts = [
        details.seniority,
        details.location,
        details.company ? `at ${details.company}` : "",
    ].filter((part) => part.length > 0);
    const detailLine = detailParts.length > 0 ? ` (${detailParts.join(", ")})` : "";
    const reply = `Saved "${title}"${detailLine} to your wishlist. I'll let you know the moment a matching role is added.`;
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return { reply, mode, confidenceSummary: ctx.confidenceSummary };
};

export const tryWishlistConfirmationResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    const messages = ctx.conversationAfterUserMessage.messages;
    const mode = ctx.modeDetection.mode;
    if (!wasWishlistSavePromptLast(messages)) {
        return null;
    }
    const declined = isNegativeConfirmation(ctx.normalizedMessage) || isWishlistDecline(ctx.normalizedMessage);
    if (declined) {
        const reply = "No problem — I won't save it. Want me to look for something else?";
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
        return { reply, mode, confidenceSummary: ctx.confidenceSummary };
    }

    const affirmative = isAffirmativeConfirmation(ctx.normalizedMessage);
    if (!isWishlistSaveConfirmation(ctx.normalizedMessage, affirmative)) {
        return null;
    }

    const proposed = extractProposedWishlistTitle(messages) ?? "";
    return await saveWishlistFromMessage(deps, ctx, proposed);
};
