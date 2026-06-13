import { buildUserAccountContext } from "./user-account-context.utils";
import type { CareerPathSummary, CareerProfileSummary } from "../external/roadmap.external.service";
import type { GapAnalysisSnapshot } from "./gap-analysis.types";
import { formatGapAnalysisForPrompt } from "./gap-analysis.service";
import { formatStartingPointForPrompt, type UserStartingPoint } from "./user-starting-point.utils";

export const formatCareerDirectionContext = (
    directions: ReadonlyArray<{
        directionName: string;
        relatedSkills: string[];
        exampleTasks: string[];
        exampleRoles: string[];
    }>
): string => {
    if (directions.length === 0) return "No career direction data available.";
    return directions
        .map(
            (d) =>
                `Direction: ${d.directionName}\n  Related skills: ${d.relatedSkills.join(", ")}\n  Example responsibilities: ${d.exampleTasks.slice(0, 5).join(", ")}\n  Example role categories: ${d.exampleRoles.join(", ")}`
        )
        .join("\n\n");
};

export const formatCareerPathsContext = (paths: readonly CareerPathSummary[]): string => {
    if (paths.length === 0) return "No explicit career path transitions found in knowledge base.";
    return paths
        .slice(0, 10)
        .map((p) => `${p.fromRole} → ${p.toRole} (overlap ${Math.round(p.overlapScore * 100)}%, skills: ${p.requiredSkills.slice(0, 8).join(", ")})`)
        .join("\n");
};

export const formatCareerProfileContext = (profile: CareerProfileSummary | null): string => {
    if (!profile) return "No chat-derived career profile available.";
    const lines: string[] = [];
    if (profile.senioritySignal) lines.push(`Seniority signal: ${profile.senioritySignal}`);
    if (profile.preferredRoles.length > 0) lines.push(`Preferred roles: ${profile.preferredRoles.join(", ")}`);
    if (profile.longTermGoals.length > 0) lines.push(`Long-term goals: ${profile.longTermGoals.join(", ")}`);
    if (profile.preferredDomains.length > 0) lines.push(`Preferred domains: ${profile.preferredDomains.join(", ")}`);
    if (profile.softSkills.length > 0) lines.push(`Soft skills: ${profile.softSkills.join(", ")}`);
    return lines.length > 0 ? lines.join("\n") : "Career profile exists but has limited signals.";
};

export const buildRoadmapGenerationPrompt = (params: {
    dreamJob: string;
    stageCount: number;
    targetYears: number;
    userProfile: Record<string, unknown> | null;
    careerProfile: CareerProfileSummary | null;
    gapAnalysis: GapAnalysisSnapshot;
    startingPoint: UserStartingPoint;
    careerDirectionContext: string;
    careerPathsContext: string;
    marketContext: string;
}): string => {
    const userContext = buildUserAccountContext(params.userProfile);
    const gapContext = formatGapAnalysisForPrompt(params.gapAnalysis);
    const coachContext = formatCareerProfileContext(params.careerProfile);
    const startingPointContext = formatStartingPointForPrompt(params.startingPoint);

    return `You are CareerCoach AI, a senior career architect.
Generate a realistic ${params.stageCount}-stage CAREER PROGRESSION roadmap toward: "${params.dreamJob}".

USER TIMELINE CONSTRAINT (critical):
- The user wants to reach this role within ${params.targetYears} year(s) or sooner.
- Create exactly ${params.stageCount} capability milestones — the number needed to cover this progression within the timeline.
- Sum of stage estimatedTimeframe values must fit within ${params.targetYears} year(s) total (or slightly less).
- Prefer realistic pacing over cramming — if the dream role normally takes longer, still compress into the user's window with focused milestones.

This is NOT a course list. This is NOT a list of job postings.
Each stage is a CAPABILITY MILESTONE representing professional growth.

USER STARTING POINT (authoritative — do not contradict):
${startingPointContext}

USER PROFILE (raw account data):
${userContext}

COACH CAREER PROFILE (from conversations — secondary; never override missing profile data):
${coachContext}

GAP ANALYSIS (user vs market for dream role):
${gapContext}

MARKET REQUIREMENTS (real job data):
${params.marketContext}

CAREER PATH TRANSITIONS (knowledge base):
${params.careerPathsContext}

CAREER DIRECTION CONTEXT:
${params.careerDirectionContext}

STAGE DESIGN RULES (CRITICAL):
- Stages MUST be capability milestones, NEVER specific job postings or company roles
- BAD stage titles: "Staff Engineer at Meta", "Architect at Google", "Senior Backend Engineer at Wix"
- GOOD stage titles: "Backend Engineering Mastery", "Technical Leadership", "Architecture Ownership", "Cross-Team Technical Influence"
- Each stage must answer: What to learn? What to practice? What responsibilities to gain? What to demonstrate? What role categories become realistic next?
- futureOpportunities and roleCategories are GENERIC role types (e.g. "Software Architect"), never company-specific
- Prioritize credibility over optimism — if the dream role requires years of experience, early stages must be experience-heavy
- Combine learning, practical execution, and professional growth
- Use gap analysis to prioritize missing skills, responsibilities, leadership, and architecture depth
- estimatedTimeframe: realistic like "3-6 months", "6-12 months"
- experienceAccumulation: e.g. "12-18 months owning production backend services"
- progressionType: "learning", "experience", or "hybrid" per stage
- Stages with progressionType "learning" are study/foundation only — do NOT set roleCategories or futureOpportunities for job hunting
- Only "experience" or "hybrid" stages should include roleCategories and futureOpportunities for job matching
- 3-5 concrete actions per stage (these drive user progress tracking)
- Include 2-3 learning resources per stage where appropriate
- currentRoleSummary in progressionMeta MUST match USER STARTING POINT exactly — never invent seniority, domains, or job titles

Respond ONLY with valid JSON:
{
  "progressionMeta": {
    "currentRoleSummary": "string — where user is today",
    "dreamRoleCategory": "string — normalized dream role category",
    "estimatedYearsToGoal": "string — must reflect up to ${params.targetYears} year(s)",
    "progressionReasoning": "string — why this path is realistic"
  },
  "gapAnalysis": {
    "skillsPresent": ["string"],
    "skillsMissing": ["string"],
    "responsibilitiesMissing": ["string"],
    "leadershipGaps": ["string"],
    "architectureGaps": ["string"],
    "domainGaps": ["string"],
    "experienceGapSummary": "string"
  },
  "stages": [
    {
      "label": "capability milestone title",
      "description": "what this milestone means professionally",
      "whyItMatters": "why this stage matters for career progression",
      "progressionType": "learning|experience|hybrid",
      "requiredCapabilities": ["capability 1", "capability 2"],
      "skillsToBuild": ["skill 1", "skill 2"],
      "responsibilitiesToGain": ["responsibility 1"],
      "actions": ["concrete action 1", "concrete action 2"],
      "resources": [{ "title": "specific resource", "platform": "Udemy" }],
      "estimatedTimeframe": "3-6 months",
      "experienceAccumulation": "what experience to accumulate",
      "roleCategories": ["role category after this stage"],
      "futureOpportunities": ["Software Architect", "Solution Architect"]
    }
  ]
}

Generate exactly ${params.stageCount} stages.`;
};
