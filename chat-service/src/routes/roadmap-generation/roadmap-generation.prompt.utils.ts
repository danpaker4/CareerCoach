import { buildUserAccountContext } from "../chat/llm/chat.user-account-context.utils";

export const formatSkillGapContext = (
    userSkills: string[],
    jobRequirements: string[],
    mustKnowSkills: string[]
): string => {
    const known = new Set(userSkills.map((s) => s.toLowerCase()));
    const allRequired = [...new Set([...jobRequirements, ...mustKnowSkills])];
    const alreadyHave = allRequired.filter((s) => known.has(s.toLowerCase()));
    const missing = allRequired.filter((s) => !known.has(s.toLowerCase()));

    const lines: string[] = [];
    if (alreadyHave.length > 0) {
        lines.push(`Skills user already has: ${alreadyHave.join(", ")}`);
    }
    if (missing.length > 0) {
        lines.push(`Skills user needs to learn: ${missing.join(", ")}`);
    }
    if (allRequired.length > 0) {
        lines.push(`All skills required by real jobs: ${allRequired.join(", ")}`);
    }
    return lines.length > 0 ? lines.join("\n") : "No specific skill gap data available.";
};

export const formatCareerDirectionContext = (
    directions: ReadonlyArray<{
        directionName: string;
        relatedSkills: string[];
        exampleTasks: string[];
        exampleRoles: string[];
    }>
): string => {
    if (directions.length === 0) {
        return "No career direction data available.";
    }
    return directions
        .map(
            (d) =>
                `Direction: ${d.directionName}\n  Related skills: ${d.relatedSkills.join(", ")}\n  Example tasks: ${d.exampleTasks.slice(0, 5).join(", ")}\n  Example roles: ${d.exampleRoles.join(", ")}`
        )
        .join("\n\n");
};

export const buildRoadmapGenerationPrompt = (params: {
    dreamJob: string;
    stageCount: number;
    userProfile: Record<string, unknown> | null;
    skillGapContext: string;
    careerDirectionContext: string;
}): string => {
    const { dreamJob, stageCount, userProfile, skillGapContext, careerDirectionContext } = params;
    const userContext = buildUserAccountContext({ serverUser: userProfile });

    return `You are CareerCoach AI, a career development expert.
Generate a personalized ${stageCount}-stage career roadmap for reaching the dream job: "${dreamJob}".

USER PROFILE:
${userContext}

SKILL GAP ANALYSIS (from real job postings for "${dreamJob}"):
${skillGapContext}

CAREER DIRECTION CONTEXT (from career knowledge base):
${careerDirectionContext}

RULES:
- Use the SKILL GAP ANALYSIS to prioritize what the user needs to learn — focus early stages on missing skills
- Use CAREER DIRECTION CONTEXT to understand the domain and typical tasks/roles
- Acknowledge skills the user already has — don't waste stages teaching what they know
- Each stage should build on the previous one progressively
- Labels must be SPECIFIC to the target role (not generic like "Foundation" or "Growth")
- Actions must be CONCRETE: mention real technologies, certifications, courses, platforms, and frameworks
- For each missing skill, suggest HOW to learn it (specific courses, projects, certifications)
- estimatedTimeframe: realistic duration like "2-3 months", "3-6 months", etc.
- Each stage should have 3-5 actions
- If user is close to the dream job already (few missing skills), compress stages and focus on advancement

Respond ONLY with valid JSON:
{
  "stages": [
    {
      "label": "string — specific stage name",
      "description": "string — 1-2 sentences describing this milestone",
      "actions": ["concrete action 1", "concrete action 2", ...],
      "estimatedTimeframe": "string — e.g. '2-3 months'"
    }
  ]
}

Generate exactly ${stageCount} stages.`;
};
