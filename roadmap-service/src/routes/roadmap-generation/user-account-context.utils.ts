const MAX_CV_CONTEXT_CHARS = 3500;
const MAX_ARRAY_ITEMS = 40;

const readString = (value: unknown): string | null => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const readStringArray = (value: unknown): readonly string[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
};

const mergeUniqueStrings = (...groups: readonly (readonly string[])[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const group of groups) {
        for (const item of group) {
            const key = item.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                out.push(item);
            }
        }
    }
    return out.slice(0, MAX_ARRAY_ITEMS);
};

const pickCvExcerpt = (serverUser: Record<string, unknown>): string | null => {
    const fromServer = readString(serverUser.cv);
    if (fromServer === null) {
        return null;
    }
    return fromServer.length > MAX_CV_CONTEXT_CHARS ? `${fromServer.slice(0, MAX_CV_CONTEXT_CHARS)}…` : fromServer;
};

export const buildUserAccountContext = (serverUser: Record<string, unknown> | null): string => {
    const server = serverUser ?? {};

    const firstName = readString(server.firstName);
    const lastName = readString(server.lastName);
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();

    const currentJob = readString(server.currentJob);
    const dreamJob = readString(server.dreamJob);
    const company = readString(server.company);
    const location = readString(server.location);
    const bio = readString(server.bio);
    const linkedInUrl = readString(server.linkedInUrl);
    const githubUrl = readString(server.githubUrl);

    const technologies = mergeUniqueStrings(readStringArray(server.technologies));
    const interests = mergeUniqueStrings(readStringArray(server.interests));
    const knownSkills = mergeUniqueStrings(readStringArray(server.knownSkills));
    const githubSkills = mergeUniqueStrings(readStringArray(server.githubSkills));
    const cvExcerpt = pickCvExcerpt(server);

    const lines: string[] = [];
    if (displayName.length > 0) {
        lines.push(`Name: ${displayName}`);
    }
    if (currentJob !== null) {
        lines.push(`Current role / headline: ${currentJob}`);
    }
    if (dreamJob !== null) {
        lines.push(`Saved dream job (long-term target): ${dreamJob}`);
    }
    if (company !== null) {
        lines.push(`Company: ${company}`);
    }
    if (location !== null) {
        lines.push(`Location: ${location}`);
    }
    if (bio !== null) {
        lines.push(`Bio: ${bio}`);
    }
    if (technologies.length > 0) {
        lines.push(`Technologies (profile): ${technologies.join(", ")}`);
    }
    if (interests.length > 0) {
        lines.push(`Interests (profile): ${interests.join(", ")}`);
    }
    if (knownSkills.length > 0) {
        lines.push(`Known skills: ${knownSkills.join(", ")}`);
    }
    if (githubSkills.length > 0) {
        lines.push(`GitHub-derived skills: ${githubSkills.join(", ")}`);
    }
    if (linkedInUrl !== null) {
        lines.push(`LinkedIn: ${linkedInUrl}`);
    }
    if (githubUrl !== null) {
        lines.push(`GitHub: ${githubUrl}`);
    }
    const roleExperience = Array.isArray(server.roleExperience) ? server.roleExperience : [];
    if (roleExperience.length > 0) {
        const expLines = roleExperience
            .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
            .map((entry) => {
                const label = readString(entry.displayLabel) ?? readString(entry.roleKey) ?? "role";
                const years = typeof entry.years === "number" ? entry.years : 0;
                const level = readString(entry.level) ?? "mid";
                return `${label} (${years}y, ${level})`;
            });
        if (expLines.length > 0) lines.push(`Role experience: ${expLines.join("; ")}`);
    }
    const achievementsRaw = server.achievements;
    if (Array.isArray(achievementsRaw)) {
        const achievementNames = achievementsRaw
            .filter((a): a is { name: string } =>
                typeof a === "object" && a !== null && "name" in a && typeof (a as { name: unknown }).name === "string"
            )
            .map((a) => a.name.trim())
            .filter((name) => name.length > 0);
        if (achievementNames.length > 0) {
            lines.push(`Achievements: ${achievementNames.slice(0, 10).join(", ")}`);
        }
    }
    if (cvExcerpt !== null) {
        lines.push(`CV excerpt (truncated): ${cvExcerpt}`);
    }

    if (lines.length === 0) {
        return "No structured account context is available yet (no CV excerpt, GitHub skills, or profile lists were provided for this turn).";
    }

    return lines.join("\n");
};
