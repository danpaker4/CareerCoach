import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";

export const getChatInternalApiKey = (): string | null => {
    const raw = process.env.CHAT_INTERNAL_API_KEY;
    if (typeof raw !== "string") {
        return null;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const isChatInternalKeyValid = (incoming: string | undefined): boolean => {
    const expected = getChatInternalApiKey();
    if (expected === null) {
        return false;
    }
    if (typeof incoming !== "string" || incoming.trim().length === 0) {
        return false;
    }
    try {
        const a = Buffer.from(expected, "utf8");
        const b = Buffer.from(incoming.trim(), "utf8");
        if (a.length !== b.length) {
            return false;
        }
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
};

export const readUserIdFromRouteParams = (request: FastifyRequest): string | null => {
    const params = request.params;
    if (typeof params !== "object" || params === null || !("userId" in params)) {
        return null;
    }
    const id = (params as { userId: unknown }).userId;
    return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
};
