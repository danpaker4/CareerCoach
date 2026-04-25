import type {
    ChatMessageRequestBody,
    JobSearchRequest,
    JobSearchResultItem,
    UserAchievementResponse,
    UserProfileResponse,
} from "../chat.types";
import { z } from "zod";

const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const isChatMessageBody = (body: unknown): body is ChatMessageRequestBody => {
    if (typeof body !== "object" || body === null) {
        return false;
    }

    return (
        "userId" in body &&
        "message" in body &&
        typeof body.userId === "string" &&
        typeof body.message === "string" &&
        (!("userProfile" in body) || typeof body.userProfile === "object" || body.userProfile === undefined || body.userProfile === null)
    );
};

export const hasUserIdParam = (params: unknown): params is { userId: string } =>
    typeof params === "object" && params !== null && "userId" in params && typeof (params as { userId: unknown }).userId === "string";

export const isAchievement = (value: unknown): value is UserAchievementResponse => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    return (
        "id" in value &&
        "name" in value &&
        "grade" in value &&
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.grade === "number"
    );
};

export const normalizeFilters = (filters: JobSearchRequest): JobSearchRequest => ({
    skills: toStringArray(filters.skills),
    interests: toStringArray(filters.interests),
    experienceLevel: typeof filters.experienceLevel === "string" ? filters.experienceLevel : "",
    keywords: toStringArray(filters.keywords),
});

export const isJobSearchResultItem = (value: unknown): value is JobSearchResultItem => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    return (
        "jobId" in value &&
        "jobTitle" in value &&
        "url" in value &&
        "seniority" in value &&
        "description" in value &&
        typeof value.jobId === "string" &&
        typeof value.jobTitle === "string" &&
        typeof value.url === "string" &&
        typeof value.seniority === "string" &&
        typeof value.description === "string"
    );
};

const userAchievementResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    grade: z.number(),
});

const userProfileResponseSchema = z.object({
    achievements: z.array(userAchievementResponseSchema).optional(),
});

export const parseUserProfileResponse = (payload: unknown): UserProfileResponse | null => {
    const parsed = userProfileResponseSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
};
