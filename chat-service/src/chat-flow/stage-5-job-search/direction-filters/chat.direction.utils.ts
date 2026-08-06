import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { JobSearchRequest } from "../../api/shared/chat.types";
import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import { CYBER_KEYWORDS_FOR_WORK_DIRECTION_FILTERS } from "../../stage-6-present-jobs/presentation/chat.service.consts";

export const buildWorkDirectionFilters = (direction: string): JobSearchRequest => {
    const normalized = direction.toLowerCase();
    const isCyber =
        normalized.includes("cyber")
        || normalized.includes("penetration")
        || normalized.includes("soc")
        || normalized.includes("security");
    const commonKeywords = [direction, ...direction.split(" ").filter((part) => part.length > 2)];
    const keywords = isCyber
        ? [...new Set([...commonKeywords, ...CYBER_KEYWORDS_FOR_WORK_DIRECTION_FILTERS])]
        : [...new Set(commonKeywords)];
    const interests = isCyber ? ["cybersecurity", "security analyst", direction] : [direction];

    return {
        skills: [],
        interests,
        experienceLevel: "",
        keywords,
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
