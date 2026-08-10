export const buildOfferJobPrompt = (threadText: string): string =>
    `You extract structured fields from a user's request to POST a job opening for other users of a career platform.\n\n` +
    `From the TEXT below, extract the job posting fields. Only use information explicitly present — never invent a company, title, salary, or details.\n\n` +
    `Return ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:\n` +
    `{"jobTitle": string, "company": string, "seniority": string, "location": string, "requirements": string[], "description": string, "salary": number | null, "url": string}\n\n` +
    `Field rules:\n` +
    `- jobTitle: the role being offered (e.g. "Senior Backend Engineer"). Empty string if absent.\n` +
    `- company: the hiring company name. Empty string if absent.\n` +
    `- seniority: the experience level — one of intern, junior, mid, senior, staff, principal, manager. Empty string if unclear.\n` +
    `- location: city / country, or "remote" / "hybrid". Empty string if absent.\n` +
    `- requirements: an array of short requirement strings (skills, years of experience, must-haves). Empty array if none given.\n` +
    `- description: the responsibilities / role summary the user provided, verbatim where possible. Empty string if absent.\n` +
    `- salary: yearly gross number only (e.g. 120000), or null if not stated.\n` +
    `- url: an application URL if one is given, otherwise an empty string.\n\n` +
    `TEXT:\n"""\n${threadText}\n"""`;
