import type { JobSearchResultItem } from "../chat.types";
import { STRIP_LINE_REGEX } from "./chat.validation.consts";
import { validateRecommendedJobIds } from "./chat.validation.utils";

export class ChatValidationService {
    validateRecommendedJobs = (reply: string, recommendedJobIds: readonly string[], availableJobs: readonly JobSearchResultItem[]): string[] =>
        validateRecommendedJobIds(reply, recommendedJobIds, availableJobs);

    sanitizeReply = (reply: string): string => reply.replace(STRIP_LINE_REGEX, "").trim();
}
