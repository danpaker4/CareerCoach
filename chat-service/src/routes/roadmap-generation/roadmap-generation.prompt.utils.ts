import { buildUserAccountContext } from "../chat/llm/chat.user-account-context.utils";

export const formatSkillGapContext = (
    userSkills: string[],
    jobRequirements: string[],
    mustKnowSkills: string[]
): string => {
    const known = new Set(userSkills.map((s) => s.toLowerCase()));
    const seenKeys = new Set<string>();
    const allRequired: string[] = [];
    for (const skill of [...jobRequirements, ...mustKnowSkills]) {
        const key = skill.toLowerCase();
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allRequired.push(skill);
        }
    }
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

RESOURCES:
- For each stage, include 3-4 learning resources (courses, articles, documentation, practice platforms)
- Each resource must have a "title" (specific name of course, article, or guide) and a "platform" (the source)
- Use ONLY these platform values: "Udemy", "Coursera", "YouTube", "Pluralsight", "Medium", "Dev.to", "freeCodeCamp", "Official Docs", "GitHub", "LeetCode", "HackerRank", "Stack Overflow", "MDN", "AWS Training", "Google Cloud", "LinkedIn Learning", "Codecademy", "edX", "Kaggle"
- Mix resource types across stages: courses, articles, practice problems, docs, and certifications
- Vary platforms across stages — don't use the same 2-3 platforms in every stage
- Resources must be relevant to the skills being learned in that stage
- Prefer well-known, real courses and content that actually exist

Respond ONLY with valid JSON:
{
  "stages": [
    {
      "label": "string — specific stage name",
      "description": "string — 1-2 sentences describing this milestone",
      "actions": ["concrete action 1", "concrete action 2", ...],
      "resources": [
        { "title": "specific course or article name", "platform": "Udemy" }
      ],
      "estimatedTimeframe": "string — e.g. '2-3 months'"
    }
  ]
}

Generate exactly ${stageCount} stages.`;
};
