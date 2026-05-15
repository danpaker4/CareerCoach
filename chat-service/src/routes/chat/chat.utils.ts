import type { FastifyRequest } from "fastify";
import type {
    ChatMessageRequestBody,
    JobSearchPlanRequest,
    JobSearchRequest,
    JobSearchResultItem,
    RawJobSearchResultItem,
    UserAchievementResponse,
    UserProfileResponse,
} from "./chat.types";
import type { ProfileInput } from "../conversation/conversation.types";
import type { CareerSignal } from "../career-profile/career-profile.types";
import { z } from "zod";

const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const toSignal = (value: string, confidence: number, evidence: string, source: CareerSignal["source"]): CareerSignal => ({
    value,
    confidence,
    evidence: [evidence],
    source,
    updatedAt: new Date(),
});

export const isChatMessageBody = (body: unknown): body is ChatMessageRequestBody => {
    if (typeof body !== "object" || body === null) {
        return false;
    }

    const conversationIdOk =
        !("conversationId" in body)
        || body.conversationId === undefined
        || (typeof body.conversationId === "string" && body.conversationId.trim().length > 0);

    return (
        "userId" in body &&
        "message" in body &&
        typeof body.userId === "string" &&
        typeof body.message === "string" &&
        conversationIdOk &&
        (!("userProfile" in body) || typeof body.userProfile === "object" || body.userProfile === undefined || body.userProfile === null)
    );
};

export const hasUserIdParam = (params: unknown): params is { userId: string } =>
    typeof params === "object" && params !== null && "userId" in params && typeof (params as { userId: unknown }).userId === "string";

export const hasUserIdAndConversationIdParams = (params: unknown): params is { userId: string; conversationId: string } => {
    if (typeof params !== "object" || params === null) {
        return false;
    }
    const record = params as { userId?: unknown; conversationId?: unknown };
    return (
        typeof record.userId === "string"
        && typeof record.conversationId === "string"
        && record.conversationId.trim().length > 0
    );
};

export const readOptionalConversationIdQuery = (request: FastifyRequest): string | undefined => {
    const query = request.query;
    if (typeof query !== "object" || query === null || !("conversationId" in query)) {
        return undefined;
    }
    const value = (query as { conversationId?: unknown }).conversationId;
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

export const readOptionalUserProfileFromBody = (body: unknown): ProfileInput | undefined => {
    if (typeof body !== "object" || body === null || !("userProfile" in body)) {
        return undefined;
    }
    const profile = (body as { userProfile: unknown }).userProfile;
    return typeof profile === "object" && profile !== null ? (profile as ProfileInput) : undefined;
};

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

export const normalizeSearchPlan = (plan: JobSearchPlanRequest): JobSearchPlanRequest => ({
    searches: Array.isArray(plan.searches)
        ? plan.searches
            .map((search) => ({
                type: search.type,
                query: typeof search.query === "string" ? search.query : "",
                filters: normalizeFilters(search.filters),
            }))
            .filter((search) => search.query.trim().length > 0 || search.filters.skills.length > 0 || search.filters.interests.length > 0)
        : [],
});

export const isJobSearchResultItem = (value: unknown): value is RawJobSearchResultItem => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const record = value as Record<string, unknown>;
    const companyOk = !("company" in record) || typeof record.company === "string";
    const salaryOk = !("salary" in record) || typeof record.salary === "number";
    const requirementsOk = !("requirements" in record) || Array.isArray(record.requirements);
    const mustKnowSkillsOk = !("mustKnowSkills" in record) || Array.isArray(record.mustKnowSkills);
    const niceToHaveSkillsOk = !("niceToHaveSkills" in record) || Array.isArray(record.niceToHaveSkills);
    const benefitsOk = !("benefits" in record) || Array.isArray(record.benefits);
    const locationOk = !("location" in record) || typeof record.location === "string" || record.location === null;

    return (
        "jobId" in record &&
        "jobTitle" in record &&
        "url" in record &&
        "seniority" in record &&
        "description" in record &&
        typeof record.jobId === "string" &&
        typeof record.jobTitle === "string" &&
        typeof record.url === "string" &&
        typeof record.seniority === "string" &&
        typeof record.description === "string" &&
        companyOk &&
        salaryOk &&
        requirementsOk &&
        mustKnowSkillsOk &&
        niceToHaveSkillsOk &&
        benefitsOk &&
        locationOk
    );
};

export const normalizeJobSearchResultItem = (job: RawJobSearchResultItem): JobSearchResultItem => ({
    id: job.jobId,
    title: job.jobTitle,
    company: job.company ?? "",
    seniority: job.seniority,
    description: job.description,
    requirements: toStringArray(job.requirements),
    mustKnowSkills: toStringArray(job.mustKnowSkills),
    niceToHaveSkills: toStringArray(job.niceToHaveSkills),
    benefits: toStringArray(job.benefits),
    salary: typeof job.salary === "number" ? job.salary : null,
    location: typeof job.location === "string" ? job.location : null,
    url: job.url,
});

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
