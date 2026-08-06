export const buildSkillsGapPrompt = (params: {
    targetRole: string;
    userAccountContext: string;
}): string => `You are a career coach. Compare the user's background to what the target role usually requires.

Target role: ${params.targetRole}

User background:
${params.userAccountContext}

Return ONLY JSON:
{
  "reply": "short coach reply listing prioritized skills to learn (gaps only), 2-6 bullets in the prose",
  "skillsToLearn": ["skill1", "skill2"]
}

Do not invent employer offers. Focus on learnable gaps.`;
