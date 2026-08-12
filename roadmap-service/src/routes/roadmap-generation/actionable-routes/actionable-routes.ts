import type { UserCareerContext } from "../gap-analysis.types";
import type { RoleMilestone } from "../path/role-milestones.types";
import type { ActionableRoute, RecommendedMission, RecommendedProject, RecommendedRole, StageActionPlan } from "./actionable-routes.types";

const cleanTargetDomain = (dreamJob: string): string => {
    const cleaned = dreamJob
        .replace(/\bat\s+.+$/i, "")
        .replace(/\b(ceo|chief executive officer|cto|chief technology officer|founder|co-founder|principal|staff|director|manager|lead|senior|junior|engineer|architect|specialist|analyst)\b/gi, "")
        .replace(/\b(of|at|a|an|the|company|organisation|organization)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned || dreamJob.trim();
};

const titleCase = (value: string): string => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

const resolveProjectLevel = (user: UserCareerContext): RecommendedProject["level"] => {
    if (user.isEntryLevel || user.roleExperienceYears < 1) return "beginner";
    if (user.roleExperienceYears >= 5 || /senior|lead|manager|director/i.test(user.roleExperienceLevel)) return "advanced";
    return "intermediate";
};

const buildRoles = (params: {
    readonly milestone: RoleMilestone;
    readonly user: UserCareerContext;
    readonly domain: string;
}): RecommendedRole[] => {
    const domain = titleCase(params.domain);
    const targetRole = params.milestone.targetRole;
    const entryRoles = [
        `${domain} Analyst`,
        `${domain} Operations Specialist`,
        `${domain} Implementation Specialist`,
        `Customer Success Specialist — ${domain}`,
        `${domain} Business Operations Associate`,
        `Junior Product Analyst — ${domain}`,
    ];
    const productRoles = [
        `${domain} Product Analyst`,
        `Associate Product Manager — ${domain}`,
        `${domain} Business Analyst`,
        `${domain} Product Operations Specialist`,
        `${domain} Implementation Manager`,
        `${domain} Customer Insights Analyst`,
    ];
    const concreteTargetRole = targetRole.includes("/") ? productRoles[0]! : targetRole;
    const leadershipRoles = [
        concreteTargetRole,
        `${domain} Team Lead`,
        `${domain} Program Manager`,
        `${domain} Product Manager`,
        `${domain} Operations Manager`,
        `${domain} Strategy Manager`,
    ];
    const roleTitles = params.milestone.progressionType === "learning"
        ? productRoles
        : /lead|manager|director|vp|chief|general manager/i.test(targetRole)
          ? leadershipRoles
          : params.user.isEntryLevel
            ? entryRoles
            : [concreteTargetRole, ...productRoles.filter((title) => title !== concreteTargetRole)];
    return [...new Set(roleTitles)].slice(0, 6).map((title, index) => ({
        id: `${params.milestone.id}.role.${index + 1}`,
        title,
        fit: index === 0 && !params.user.isEntryLevel ? "pursue-now" : "prepare-first",
        whyItFits: index === 0
            ? `This is the closest practical next role from ${params.user.currentJob} toward ${targetRole}.`
            : `This role builds adjacent ${params.domain} experience while using capabilities already present in your profile.`,
        experienceGained: `Hands-on ${params.domain} delivery, stakeholder work, and measurable ownership relevant to ${targetRole}.`,
        missingRequirements: params.milestone.capabilityIds
            .filter((capability) => !params.user.userSkills.some((skill) => capability.toLowerCase().includes(skill.toLowerCase())))
            .map((capability) => capability.replace(/^cap\./, "").replaceAll(".", " "))
            .slice(0, 4),
        internalMoveSuitable: index < 2 && params.user.currentJob !== "Not yet employed",
        source: "profile-match",
    }));
};

const buildMission = (milestone: RoleMilestone, user: UserCareerContext, domain: string): RecommendedMission => ({
    id: `${milestone.id}.mission.1`,
    title: `Own a measurable ${domain} initiative at work`,
    requestToManager: `I want to grow toward ${milestone.targetRole}. Could I own a scoped ${domain} initiative this quarter, including stakeholder discovery, delivery, and a measurable outcome?`,
    responsibilities: [
        `Define one ${domain} problem with a stakeholder`,
        "Own scope, milestones, risks, and progress updates",
        "Present results and a retrospective to the team",
    ],
    outcomes: ["One delivered initiative", "A before/after metric", "Manager or stakeholder feedback"],
    fallback: `If this work is unavailable at ${user.currentJob}, choose the project route or pursue one of the recommended roles.`,
    source: "reviewed-template",
});

const buildProjects = (params: {
    readonly milestone: RoleMilestone;
    readonly user: UserCareerContext;
    readonly domain: string;
}): RecommendedProject[] => {
    const level = resolveProjectLevel(params.user);
    const hours = level === "beginner" ? 20 : level === "intermediate" ? 35 : 50;
    const capabilities = params.milestone.capabilityIds.map((capability) => capability.replace(/^cap\./, "").replaceAll(".", " "));
    const projectSeeds = [
        { title: `Map and improve a ${params.domain} customer journey`, result: "a tested workflow improvement" },
        { title: `Design a ${params.domain} product opportunity case`, result: "an evidence-backed product recommendation" },
        { title: `Create a ${params.domain} operating-metrics review`, result: "a decision-ready metrics and action plan" },
        { title: `Run a ${params.domain} risk and controls assessment`, result: "a prioritized risk-reduction proposal" },
        { title: `Prepare a ${params.domain} market-entry brief`, result: "a focused go-to-market recommendation" },
        { title: `Plan a cross-functional ${params.domain} pilot`, result: "an executable pilot and measurement plan" },
    ];
    return projectSeeds.map((seed, index) => ({
        id: `${params.milestone.id}.project.${index + 1}`,
        title: seed.title,
        objective: `Produce ${seed.result} that demonstrates the outcome required for ${params.milestone.targetRole}.`,
        tasks: [
            `Choose one narrow ${params.domain} problem and define who experiences it`,
            "Research the current workflow through public information or interviews you arrange",
            "Define success metrics and constraints before proposing a solution",
            "Create the analysis, plan, prototype, or operating document yourself",
            "Ask at least one relevant person to review it and record what you changed",
        ],
        deliverables: ["Problem statement", "Research notes", "Proposed solution", "Success metrics", "Short case study"],
        estimatedHours: hours,
        completionChecklist: ["All ordered tasks completed", "Deliverables collected", "At least one review incorporated"],
        toolsAndSkills: [...new Set([...params.user.userSkills.slice(0, 3), ...capabilities.slice(0, 3)])],
        roleRelevance: `Builds evidence for ${params.milestone.targetRole}: ${params.milestone.whatYouGain}`,
        optionalGuidance: [
            "Keep the problem narrow enough to finish within the estimate",
            "Do not use confidential employer or customer information",
            "Use public information or a synthetic sample you create when examples are necessary",
        ],
        level,
        source: "reviewed-template",
    }));
};

export const buildStageActionPlan = (params: {
    readonly milestone: RoleMilestone;
    readonly user: UserCareerContext;
    readonly dreamJob: string;
    readonly resourceUrls: readonly string[];
}): StageActionPlan => {
    const domain = cleanTargetDomain(params.dreamJob);
    const roles = buildRoles({ milestone: params.milestone, user: params.user, domain });
    const mission = buildMission(params.milestone, params.user, domain);
    const projects = buildProjects({ milestone: params.milestone, user: params.user, domain });
    const canUseInternalRoute = params.user.currentJob !== "Not yet employed" && params.user.currentJob !== "Not specified";
    const recommendedType: ActionableRoute["type"] = params.milestone.progressionType === "learning"
        ? "combined"
        : canUseInternalRoute
          ? "internal"
          : "project";
    const routes: ActionableRoute[] = [
        {
            id: `${params.milestone.id}.route.recommended`,
            type: recommendedType,
            title: recommendedType === "internal" ? "Grow through a real internal mission" : recommendedType === "project" ? "Build proof through a guided project" : "Build proof, then pursue a relevant role",
            summary: recommendedType === "internal" ? mission.title : projects[0]!.title,
            whyRecommended: `Recommended from your current role (${params.user.currentJob}), experience level, and the next required outcome toward ${params.dreamJob}.`,
            completionRule: `Check this route complete after you finish one selected path and achieve: ${params.milestone.whatYouGain}`,
            isRecommended: true,
            source: "profile-match",
            confidence: params.user.currentJob === "Not specified" ? "low" : "high",
            roleOptions: roles,
            missionOptions: canUseInternalRoute ? [mission] : [],
            projectOptions: projects,
            supportingResourceUrls: params.resourceUrls,
        },
        {
            id: `${params.milestone.id}.route.job`, type: "job", title: "Move into a role that provides the experience", summary: `Pursue ${roles[0]?.title ?? params.milestone.targetRole}.`, whyRecommended: "Use this route when your current company cannot provide the required scope. Live vacancies are checked when you open a role.", completionRule: `Complete when you have worked in one recommended role and achieved the stage outcome.`, isRecommended: false, source: "profile-match", confidence: "medium", roleOptions: roles, missionOptions: [], projectOptions: [], supportingResourceUrls: params.resourceUrls,
        },
        {
            id: `${params.milestone.id}.route.project`, type: "project", title: "Build the evidence through a side project", summary: projects[0]!.title, whyRecommended: "Use this route when you cannot yet access the work through employment.", completionRule: "Complete one selected project brief and check its completion list.", isRecommended: false, source: "reviewed-template", confidence: "high", roleOptions: roles, missionOptions: [], projectOptions: projects, supportingResourceUrls: params.resourceUrls,
        },
    ];
    return { outcome: params.milestone.whatYouGain, recommendedRouteId: routes[0]!.id, routes };
};
