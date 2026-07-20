import type { ProfileInput } from "../../../routes/conversation/conversation.types";
import { pickCvExcerpt } from "./cv-context.utils";
import { readString } from "./profile-field.utils";
import { resolveProfileLists } from "./profile-lists.utils";

export const buildUserAccountContext = (params: {
    readonly serverUser: Record<string, unknown> | null;
    readonly profile?: ProfileInput | null;
}): string => {
    const server = params.serverUser ?? {};
    const profile = params.profile ?? null;

    const firstName = readString(profile?.firstName) ?? readString(server.firstName);
    const lastName = readString(profile?.lastName) ?? readString(server.lastName);
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();

    const currentJob = readString(profile?.currentJob) ?? readString(server.currentJob);
    const dreamJob = readString(server.dreamJob);
    const company = readString(server.company);
    const location = readString(server.location);
    const bio = readString(server.bio);
    const linkedInUrl = readString(server.linkedInUrl);
    const githubUrl = readString(server.githubUrl);

    const { technologies, interests, knownSkills, githubSkills } = resolveProfileLists(server, profile);
    const cvExcerpt = pickCvExcerpt(server, profile);

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
    if (cvExcerpt !== null) {
        lines.push(`CV excerpt (truncated): ${cvExcerpt}`);
    }

    if (lines.length === 0) {
        return "No structured account context is available yet (no CV excerpt, GitHub skills, or profile lists were provided for this turn).";
    }

    return lines.join("\n");
};
