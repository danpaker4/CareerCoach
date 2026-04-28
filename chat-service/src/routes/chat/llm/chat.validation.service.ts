import type { JobSearchResultItem } from "../chat.types";

const JOB_ID_REGEX = /jobId\s*[:#-]?\s*([A-Za-z0-9-]+)/gi;
const STRIP_LINE_REGEX = /^\s*[-*]?\s*(salary|requirements?)\b.*$/gim;

export class ChatValidationService {
    extractJobIdsFromReply = (reply: string): string[] => {
        const extractedIds: string[] = [];
        const matches = reply.matchAll(JOB_ID_REGEX);
        for (const match of matches) {
            const [, id] = match;
            if (id) {
                extractedIds.push(id);
            }
        }
        return extractedIds;
    };

    validateRecommendedJobs = (reply: string, recommendedJobIds: readonly string[], availableJobs: readonly JobSearchResultItem[]): string[] => {
        const availableJobIds = new Set(availableJobs.map((job) => job.jobId));
        const extractedFromText = this.extractJobIdsFromReply(reply);
        const allMentionedIds = [...new Set([...recommendedJobIds, ...extractedFromText])];
        const invalidIds = allMentionedIds.filter((id) => !availableJobIds.has(id));

        if (invalidIds.length > 0) {
            throw new Error(`Invalid recommended jobIds detected: ${invalidIds.join(", ")}`);
        }

        return allMentionedIds;
    };

    sanitizeReply = (reply: string): string => reply.replace(STRIP_LINE_REGEX, "").trim();
}
