import type { ConversationMode } from "./conversation-mode/conversation-mode.types";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import type { Conversation } from "./conversation/conversation.model";
import type { JobSearchRequest } from "./chat.types";
import type { DomainExplorationTarget } from "./chat.service.types";
import {
    DOMAIN_EXPLORATION_PHRASES,
    DOMAIN_TARGETS,
    JOB_SEARCH_DEEP_DISCOVERY_DISCOVERY_MIN,
    JOB_SEARCH_READINESS_DEFAULT_MIN,
    JOB_SEARCH_READINESS_FAST_SEARCH_MIN,
    STAGE_SKIP_SIGNALS,
    WORK_DIRECTION_PHRASES,
    WORK_DIRECTION_QUERY_REGEXES,
    CYBER_KEYWORDS_FOR_WORK_DIRECTION_FILTERS,
} from "./chat.service.consts";

export const isStageSkipRequested = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return STAGE_SKIP_SIGNALS.some((signal) => normalized.includes(signal));
};

export const buildDiscoveryQuestion = (message: string): string => {
    const normalized = message.toLowerCase();
    if (normalized.includes("don't know") || normalized.includes("not sure") || normalized.includes("no idea")) {
        return "No problem. Which sounds more interesting now: building apps, solving technical bugs, analyzing data, helping customers, or managing projects?";
    }
    return "Would you rather build something, investigate systems, explain things to people, or improve team processes?";
};

export const shouldRunJobSearch = (
    mode: ConversationMode,
    llmShouldSearch: boolean,
    searchReadinessConfidence: number,
    discoveryConfidence: number,
    forceDomainExplorationSearch: boolean
): boolean => {
    if (forceDomainExplorationSearch) {
        return true;
    }
    if (mode === "FAST_SEARCH" && searchReadinessConfidence >= JOB_SEARCH_READINESS_FAST_SEARCH_MIN) {
        return true;
    }
    if (searchReadinessConfidence >= JOB_SEARCH_READINESS_DEFAULT_MIN) {
        return true;
    }
    if (mode === "DEEP_DISCOVERY" && discoveryConfidence >= JOB_SEARCH_DEEP_DISCOVERY_DISCOVERY_MIN) {
        return true;
    }
    return llmShouldSearch;
};

export const detectDomainExplorationTarget = (message: string): DomainExplorationTarget | null => {
    const normalized = message.toLowerCase();
    const asksDomainExploration = DOMAIN_EXPLORATION_PHRASES.some((phrase) => normalized.includes(phrase));
    const matchedDomain = DOMAIN_TARGETS.find((target) => normalized.includes(target.domain));
    if (!matchedDomain) {
        return null;
    }
    if (asksDomainExploration) {
        return matchedDomain;
    }
    const directOpportunityAsk =
        normalized.includes("opportunities") || normalized.includes("jobs in") || normalized.includes("what can i");
    return directOpportunityAsk ? matchedDomain : null;
};

const normalizeWorkDirection = (raw: string): string => {
    const normalized = raw.trim().replace(/\s+/g, " ");
    const fixLeadingJ = normalized.replace(/\bunior\b/gi, "Junior");
    const fixCyber = fixLeadingJ.replace(/\bcyber\s*security\b/gi, "cybersecurity");
    return fixCyber;
};

export const extractWorkDirectionQuery = (message: string): string | null => {
    const normalized = message.trim();
    const lowered = normalized.toLowerCase();
    for (const pattern of WORK_DIRECTION_QUERY_REGEXES) {
        const match = normalized.match(pattern);
        const candidate = match?.[1]?.trim();
        if (candidate) {
            return normalizeWorkDirection(candidate);
        }
    }
    const trigger = WORK_DIRECTION_PHRASES.find((phrase) => lowered.includes(phrase));
    if (!trigger) {
        return null;
    }

    const triggerIndex = lowered.indexOf(trigger);
    const suffix = normalized.slice(triggerIndex + trigger.length).trim().replace(/^[\s:,-]+/, "");
    if (suffix.length > 0) {
        return normalizeWorkDirection(suffix);
    }

    const domainTarget = DOMAIN_TARGETS.find((target) => lowered.includes(target.domain));
    if (domainTarget) {
        return normalizeWorkDirection(domainTarget.domain);
    }
    return null;
};

export const isWorkDirectionIntent = (message: string): boolean => {
    const lowered = message.toLowerCase();
    const extractedDirection = extractWorkDirectionQuery(message);
    if (extractedDirection) {
        return true;
    }
    const interestPattern = /\b(interested|interesting|intersting|fits me|maybe|choose|start with)\b/i;
    const domainMentioned = DOMAIN_TARGETS.some((target) => lowered.includes(target.domain));
    if (interestPattern.test(lowered) && domainMentioned) {
        return true;
    }
    if (/search.*job.*as/i.test(lowered) || /i want to be\b/i.test(lowered)) {
        return true;
    }
    return (
        DOMAIN_TARGETS.some((target) => lowered.includes(target.domain))
        && (lowered.includes("jobs")
            || lowered.includes("work")
            || lowered.includes("offer")
            || lowered.includes("role")
            || lowered.includes("direction"))
    );
};

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

export const buildDomainExplorationFilters = (
    target: DomainExplorationTarget,
    llmFilters: JobSearchRequest,
    profileTechnologies: readonly { value: string }[]
): JobSearchRequest => {
    const skills = [...new Set([...llmFilters.skills, ...profileTechnologies.map((item) => item.value)])];
    const interests = [...new Set([...llmFilters.interests, target.domain, ...target.roleHints])];
    const keywords = [...new Set([...llmFilters.keywords, ...target.keywords, ...target.roleHints])];
    return {
        skills,
        interests,
        experienceLevel: llmFilters.experienceLevel,
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
