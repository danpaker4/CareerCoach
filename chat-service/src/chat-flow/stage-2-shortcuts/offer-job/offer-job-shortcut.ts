import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { parseJobOfferFromJson } from "./chat.offer-job.llm.utils";
import { buildOfferJobPrompt } from "./chat.offer-job.prompt.utils";
import type { JobOfferDraft } from "./chat.offer-job.types";
import {
    OFFER_JOB_COLLECT_MARKER,
    collectOfferThreadText,
    findMissingOfferFields,
    isOfferJobIntent,
    wasOfferJobCollectionPromptLast,
} from "./chat.offer-job.utils";

const extractJobOffer = async (
    deps: ChatFlowDeps,
    threadText: string,
    userId: string
): Promise<JobOfferDraft> => {
    const rawText = await deps.textCompletion.complete(
        buildOfferJobPrompt(threadText),
        { operation: "chat.offer_job", userId }
    );
    try {
        return parseJobOfferFromJson(rawText);
    } catch {
        return { jobTitle: "", company: "", seniority: "", location: "", requirements: [], description: "" };
    }
};

export const tryOfferJobShortcutResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    const messages = ctx.conversationAfterUserMessage.messages;
    const mode = ctx.modeDetection.mode;
    const isContinuation = wasOfferJobCollectionPromptLast(messages);
    if (!isOfferJobIntent(ctx.normalizedMessage) && !isContinuation) {
        return null;
    }

    const threadText = collectOfferThreadText(messages, ctx.normalizedMessage);
    const draft = await extractJobOffer(deps, threadText, ctx.userId);
    // The model sometimes fails to isolate a description from terse input — fall back to
    // the user's own words (the accumulated offer thread) so we don't nag for what they gave us.
    const effectiveDescription = draft.description.trim().length >= 40
        ? draft.description.trim()
        : threadText.trim();
    const draftForValidation = {
        jobTitle: draft.jobTitle,
        company: draft.company,
        seniority: draft.seniority,
        location: draft.location,
        requirements: draft.requirements,
        description: effectiveDescription,
        salary: draft.salary,
    };
    const missing = findMissingOfferFields(draftForValidation);

    if (missing.length > 0) {
        const needList = missing.length > 1
            ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`
            : missing[0];
        const reply =
            `${OFFER_JOB_COLLECT_MARKER}. I can post this opening so other CareerCoach users see it, ` +
            `and anyone who saved a matching wanted job gets alerted automatically. I still need ${needList}. ` +
            `Just include that in your next message.`;
        console.info(`[CHAT][OFFER_JOB] userId=${ctx.userId} status=collecting missing=${missing.length}`);
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
        return { reply, mode, confidenceSummary: ctx.confidenceSummary };
    }

    const result = await deps.externalService.createJob({
        jobTitle: draft.jobTitle.trim(),
        company: draft.company.trim(),
        description: effectiveDescription,
        seniority: draft.seniority.trim(),
        location: draft.location.trim(),
        requirements: draft.requirements,
        salary: draft.salary,
        url: draft.url,
    });

    if (result.status === "error") {
        console.warn(`[CHAT][OFFER_JOB] userId=${ctx.userId} status=error message=${result.message}`);
        const reply =
            `I tried to post "${draft.jobTitle.trim()}" at ${draft.company.trim()}, but something went wrong on our end. ` +
            `Want me to try posting it again?`;
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
        return { reply, mode, confidenceSummary: ctx.confidenceSummary };
    }

    console.info(`[CHAT][OFFER_JOB] userId=${ctx.userId} status=created jobId=${result.id} title="${result.jobTitle}"`);
    const salaryLine = draft.salary ? ` (~$${draft.salary.toLocaleString("en-US")}/yr)` : "";
    const reply =
        `Done! I posted "${result.jobTitle}" at ${result.company}${salaryLine}. ` +
        `It's now live for other CareerCoach users, and anyone who saved a matching wanted job will be alerted automatically. ` +
        `Want to post another role?`;
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return { reply, mode, confidenceSummary: ctx.confidenceSummary };
};
