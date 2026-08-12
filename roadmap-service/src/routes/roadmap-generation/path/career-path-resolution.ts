import { resolveRoleArchetype } from "../catalog/role-archetype.consts";
import type { ResolvedCareerPath } from "./career-path-resolution.types";

const EXECUTIVE_CYBER_PATH_BEGINNER = [
    "CS degree / technical foundations",
    "Cybersecurity Engineer / Analyst (first job)",
    "Senior Security Engineer",
    "Security Team Lead / Engineering Manager",
    "Director of Security",
    "VP Security / CISO",
    "Founder / GM track",
    "CEO (cybersecurity company)",
] as const;

const EXECUTIVE_CYBER_PATH = [
    "Security Engineer",
    "Senior Security Engineer",
    "Security Architect",
    "Security Engineering Manager",
    "Director of Security",
    "VP Security / CISO",
    "General Manager / Founder track",
    "CEO (cybersecurity company)",
] as const;

const ARCHITECTURE_PATH_BEGINNER = [
    "Software Engineer (first job)",
    "Senior Software Engineer",
    "Staff Engineer / Lead Architect",
    "Principal Engineer",
    "Principal Architect",
] as const;

const ARCHITECTURE_PATH = [
    "Senior Software Engineer / Software Architect",
    "Staff Engineer / Lead Architect",
    "Principal Engineer / Principal Architect",
    "Principal Architect",
] as const;

const ENGINEERING_PATH = [
    "Software Engineer",
    "Senior Software Engineer",
    "Staff Engineer",
] as const;

const trimPathToTargetYears = (steps: readonly string[], targetYears: number): string[] => {
    if (targetYears <= 3) return [...steps.slice(0, 3), steps[steps.length - 1]!].filter(Boolean);
    if (targetYears <= 6) return [...steps.slice(0, 5), steps[steps.length - 1]!].filter(Boolean);
    return [...steps];
};

export const resolveSelectedCareerPath = (params: {
    readonly currentJob: string;
    readonly dreamJob: string;
    readonly targetYears: number;
    readonly knownPathRoles?: readonly string[];
    readonly isEntryLevel?: boolean;
    readonly hasNoSkills?: boolean;
}): ResolvedCareerPath => {
    const archetype = resolveRoleArchetype(params.dreamJob);
    const zeroKnowledge = params.isEntryLevel === true || params.hasNoSkills === true;

    if (archetype === "executive") {
        const executivePath = [
            "Domain specialist / product contributor",
            "Senior contributor / project lead",
            "Team Lead / Manager",
            "Director / VP",
            "General Manager / Founder track",
            params.dreamJob,
        ];
        return {
            steps: trimPathToTargetYears(executivePath, params.targetYears),
            reasonCodes: ["path_executive", "jobs_projects_learning", "intermediate_roles_required", "exact_target_preserved"],
        };
    }

    if (archetype === "executive_cyber") {
        const base = zeroKnowledge ? EXECUTIVE_CYBER_PATH_BEGINNER : EXECUTIVE_CYBER_PATH;
        const steps = trimPathToTargetYears(base, params.targetYears);
        return {
            steps: [...steps],
            reasonCodes: [
                "path_executive_cyber",
                "intermediate_roles_required",
                ...(zeroKnowledge ? ["beginner_degree_then_job_then_lead"] : []),
            ],
        };
    }

    if (archetype === "architecture_ic") {
        const base = zeroKnowledge ? ARCHITECTURE_PATH_BEGINNER : ARCHITECTURE_PATH;
        return {
            steps: trimPathToTargetYears(base, params.targetYears),
            reasonCodes: ["path_architecture_ic", "jobs_plus_learning", "intermediate_roles_required"],
        };
    }

    if (archetype === "engineering_ic") {
        return {
            steps: trimPathToTargetYears(ENGINEERING_PATH, params.targetYears),
            reasonCodes: ["path_engineering_ic", "jobs_plus_learning", "intermediate_roles_required"],
        };
    }

    if (params.knownPathRoles && params.knownPathRoles.length > 0) {
        return {
            steps: [...new Set([params.currentJob, ...params.knownPathRoles, params.dreamJob].filter(Boolean))],
            reasonCodes: ["path_from_known_transitions"],
        };
    }

    return {
        steps: [params.currentJob, params.dreamJob].filter((role) => role.trim().length > 0),
        reasonCodes: ["path_direct_or_sparse"],
    };
};
