import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { JobSearchRequest } from "../../api/shared/chat.types";
import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import {
    CYBER_KEYWORDS_FOR_WORK_DIRECTION_FILTERS,
    QA_KEYWORDS_FOR_WORK_DIRECTION_FILTERS,
} from "../../stage-6-present-jobs/presentation/chat.service.consts";

const isCyberDirection = (normalized: string): boolean =>
    normalized.includes("cyber")
    || normalized.includes("penetration")
    || normalized.includes("soc")
    || normalized.includes("security");

const isQaDirection = (normalized: string): boolean => {
    const compact = normalized.replace(/[^a-z0-9]/g, " ");
    return (
        /\bqa\b/.test(compact)
        || compact.includes("quality assurance")
        || compact.includes("test automation")
        || compact.includes("software test")
        || compact.includes("sdet")
        || compact.includes("quality engineer")
    );
};

export const buildWorkDirectionFilters = (direction: string): JobSearchRequest => {
    const normalized = direction.toLowerCase();
    const commonKeywords = [direction, ...direction.split(" ").filter((part) => part.length > 2)];
    if (isCyberDirection(normalized)) {
        return {
            skills: [],
            interests: ["cybersecurity", "security analyst", direction],
            experienceLevel: "",
            keywords: [...new Set([...commonKeywords, ...CYBER_KEYWORDS_FOR_WORK_DIRECTION_FILTERS])],
        };
    }
    if (isQaDirection(normalized)) {
        return {
            skills: [],
            interests: ["quality assurance", "qa", direction],
            experienceLevel: "",
            keywords: [...new Set([...commonKeywords, ...QA_KEYWORDS_FOR_WORK_DIRECTION_FILTERS])],
        };
    }

    return {
        skills: [],
        interests: [direction],
        experienceLevel: "",
        keywords: [...new Set(commonKeywords)],
    };
};

export const buildBroaderJobSearchFilters = (
    jobContext: Conversation["jobContext"],
    profile: UserCareerProfile
): JobSearchRequest => {
    const query = jobContext?.lastSearchQuery?.trim();
    if (query && query.length > 0) {
        const base = buildWorkDirectionFilters(query);
        return {
            ...base,
            keywords: [...new Set([...base.keywords, "entry level", "junior", "associate", "related"])],
            interests: [...new Set([...base.interests, "adjacent roles"])],
        };
    }
    const tech = profile.technologies.slice(0, 6).map((item) => item.value);
    const interests = profile.interests.slice(0, 4).map((item) => item.value);
    const roles = profile.preferredRoles.slice(0, 3).map((item) => item.value);
    return {
        skills: tech,
        interests: interests.length > 0 ? interests : ["career exploration"],
        experienceLevel: "",
        keywords: [...new Set([...roles, "junior", "entry level", "related"])],
    };
};
