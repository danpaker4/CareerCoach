import type { JobSearchResultItem } from "../../api/shared/chat.types";
import { JOB_ID_LEAK_REGEX, STRIP_LINE_REGEX } from "./chat.validation.consts";
import { validateRecommendedJobIds } from "./chat.validation.utils";

export const validateRecommendedJobs = (
    reply: string,
    recommendedJobIds: readonly string[],
    availableJobs: readonly JobSearchResultItem[]
): string[] => validateRecommendedJobIds(reply, recommendedJobIds, availableJobs);

export const sanitizeReply = (reply: string): string =>
    reply
        .replace(JOB_ID_LEAK_REGEX, "")
        .replace(STRIP_LINE_REGEX, "")
        .replace(/\s{2,}/g, " ")
        .trim();
