import type { ChatMessageResponse } from "../chat.types";
import type { ChatQueueJob, ChatRequestEvent } from "./chat-queue.types";

const parseJson = (value: string): unknown => JSON.parse(value) as unknown;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(isString);

const isChatMessageResponse = (value: unknown): value is ChatMessageResponse => {
    if (!isRecord(value)) {
        return false;
    }

    return value.reply === undefined || typeof value.reply === "string";
};

export const parseChatQueueJob = (content: Buffer): ChatQueueJob | null => {
    const parsed = parseJson(content.toString("utf8"));
    if (!isRecord(parsed)) {
        return null;
    }

    if (
        !isString(parsed.requestId) ||
        !isString(parsed.userId) ||
        !isString(parsed.conversationId) ||
        !isString(parsed.message)
    ) {
        return null;
    }

    return {
        requestId: parsed.requestId,
        userId: parsed.userId,
        conversationId: parsed.conversationId,
        message: parsed.message,
        ...(isRecord(parsed.userProfile)
            ? {
                userProfile: {
                    ...(isString(parsed.userProfile.firstName) ? { firstName: parsed.userProfile.firstName } : {}),
                    ...(isString(parsed.userProfile.lastName) ? { lastName: parsed.userProfile.lastName } : {}),
                    ...(isString(parsed.userProfile.currentJob) ? { currentJob: parsed.userProfile.currentJob } : {}),
                    ...(isStringArray(parsed.userProfile.technologies) ? { technologies: parsed.userProfile.technologies } : {}),
                    ...(isStringArray(parsed.userProfile.interests) ? { interests: parsed.userProfile.interests } : {}),
                    ...(isStringArray(parsed.userProfile.githubSkills) ? { githubSkills: parsed.userProfile.githubSkills } : {}),
                    ...(isStringArray(parsed.userProfile.knownSkills) ? { knownSkills: parsed.userProfile.knownSkills } : {}),
                    ...(isString(parsed.userProfile.cvExcerpt) ? { cvExcerpt: parsed.userProfile.cvExcerpt } : {}),
                },
              }
            : {}),
    };
};

export const parseChatRequestEvent = (content: Buffer): ChatRequestEvent | null => {
    const parsed = parseJson(content.toString("utf8"));
    if (!isRecord(parsed)) {
        return null;
    }

    if (!isString(parsed.type) || !isString(parsed.requestId) || !isString(parsed.userId) || !isString(parsed.conversationId)) {
        return null;
    }

    if (parsed.type === "queued" && parsed.status === "queued") {
        return {
            type: "queued",
            requestId: parsed.requestId,
            userId: parsed.userId,
            conversationId: parsed.conversationId,
            status: "queued",
        };
    }

    if (parsed.type === "started" && parsed.status === "started") {
        return {
            type: "started",
            requestId: parsed.requestId,
            userId: parsed.userId,
            conversationId: parsed.conversationId,
            status: "started",
        };
    }

    if (parsed.type === "completed" && parsed.status === "completed" && isChatMessageResponse(parsed.response)) {
        return {
            type: "completed",
            requestId: parsed.requestId,
            userId: parsed.userId,
            conversationId: parsed.conversationId,
            status: "completed",
            response: parsed.response,
        };
    }

    if (parsed.type === "failed" && parsed.status === "failed" && isString(parsed.error)) {
        return {
            type: "failed",
            requestId: parsed.requestId,
            userId: parsed.userId,
            conversationId: parsed.conversationId,
            status: "failed",
            error: parsed.error,
        };
    }

    return null;
};

export const serializeChatQueuePayload = (payload: ChatQueueJob | ChatRequestEvent): Buffer =>
    Buffer.from(JSON.stringify(payload), "utf8");

