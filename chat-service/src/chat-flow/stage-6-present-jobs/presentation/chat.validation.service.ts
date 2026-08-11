import type { JobSearchResultItem } from "../../api/shared/chat.types";
import {
    BARE_UUID_REGEX,
    JOB_ID_LEAK_REGEX,
    MAX_REPLY_LINES,
    STRIP_LINE_REGEX,
} from "./chat.validation.consts";
import { validateRecommendedJobIds } from "./chat.validation.utils";

export const validateRecommendedJobs = (
    reply: string,
    recommendedJobIds: readonly string[],
    availableJobs: readonly JobSearchResultItem[]
): string[] => validateRecommendedJobIds(reply, recommendedJobIds, availableJobs);

const capLines = (reply: string): string => {
    const lines = reply.split("\n");
    let kept = 0;
    const capped: string[] = [];
    for (const line of lines) {
        if (line.trim().length > 0) {
            if (kept === MAX_REPLY_LINES) break;
            kept += 1;
        }
        capped.push(line);
    }
    return capped.join("\n");
};

export const sanitizeReply = (reply: string): string =>
    capLines(
        reply
            .replace(JOB_ID_LEAK_REGEX, "")
            .replace(BARE_UUID_REGEX, "")
            .replace(STRIP_LINE_REGEX, "")
            .replace(/[^\S\n]{2,}/g, " ")
            .replace(/\n{3,}/g, "\n\n")
    ).trim();
