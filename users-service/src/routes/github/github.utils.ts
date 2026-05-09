import {
    GITHUB_API_HEADERS,
    MANIFEST_PATHS,
    MANIFEST_SKILL_PATTERNS,
    MAX_MANIFEST_FILES_PER_REPOSITORY,
    MAX_REPOSITORIES_TO_ANALYZE,
    MAX_SKILLS_TO_STORE,
    PACKAGE_SKILL_MAP,
    ROOT_FILE_SKILL_PATTERNS,
    SKILL_ALIASES,
} from "./github.consts";
import type { GithubRepository, GithubRepositoryLanguages, GithubUserEmail } from "./github.types";
import { uploadAvatarToS3 } from "../cv/s3-upload/s3-upload.service";

export const buildGithubRequestInit = (accessToken: string): RequestInit => ({
    headers: {
        Authorization: `Bearer ${accessToken}`,
        ...GITHUB_API_HEADERS,
    },
});

export const getFileNameFromPath = (path: string): string => {
    const segments = path.split("/");
    return segments[segments.length - 1] ?? path;
};

export const getAvatarExtension = (contentType: string): string => {
    if (contentType === "image/png") {
        return "png";
    }

    if (contentType === "image/gif") {
        return "gif";
    }

    if (contentType === "image/webp") {
        return "webp";
    }

    return "jpg";
};

export const toTitleCase = (value: string): string =>
    value
        .split(" ")
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");

export const normalizeSkill = (value: string): string | null => {
    const sanitizedValue = value.trim();
    if (!sanitizedValue) {
        return null;
    }

    const normalizedKey = sanitizedValue.toLowerCase().replace(/[_-]+/g, " ");
    if (!normalizedKey) {
        return null;
    }

    return SKILL_ALIASES[normalizedKey] ?? toTitleCase(normalizedKey);
};

export const addSkillWeight = (skills: Map<string, number>, skill: string | null, weight: number): void => {
    if (!skill) {
        return;
    }

    skills.set(skill, (skills.get(skill) ?? 0) + weight);
};

export const rankRepositoriesForAnalysis = (repositories: GithubRepository[]): GithubRepository[] =>
    [...repositories]
        .filter((repository) => !repository.fork && !repository.archived)
        .sort((left, right) => {
            if (right.stargazers_count !== left.stargazers_count) {
                return right.stargazers_count - left.stargazers_count;
            }

            return new Date(right.pushed_at).getTime() - new Date(left.pushed_at).getTime();
        })
        .slice(0, MAX_REPOSITORIES_TO_ANALYZE);

export const buildGithubSkillList = (
    repositories: GithubRepository[],
    repositoryLanguages: GithubRepositoryLanguages[],
    manifestSkills: string[],
): string[] => {
    const weightedSkills = new Map<string, number>();
    const projectCountSkill = repositories.length > 0 ? `${repositories.length} GitHub Projects` : null;

    repositories.forEach((repository) => {
        addSkillWeight(weightedSkills, normalizeSkill(repository.language ?? ""), 3);
        repository.topics.forEach((topic) => addSkillWeight(weightedSkills, normalizeSkill(topic), 2));
    });

    repositoryLanguages.forEach((languageMap) => {
        Object.keys(languageMap).forEach((language) => addSkillWeight(weightedSkills, normalizeSkill(language), 1));
    });

    manifestSkills.forEach((skill) => addSkillWeight(weightedSkills, normalizeSkill(skill), 4));
    addSkillWeight(weightedSkills, projectCountSkill, 1000);

    return [...weightedSkills.entries()]
        .sort((left, right) => {
            if (right[1] !== left[1]) {
                return right[1] - left[1];
            }

            return left[0].localeCompare(right[0]);
        })
        .slice(0, MAX_SKILLS_TO_STORE)
        .map(([skill]) => skill);
};

export const parsePackageJsonSkills = (manifestContent: string): string[] => {
    try {
        const parsed = JSON.parse(manifestContent) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };

        const dependencyNames = [
            ...Object.keys(parsed.dependencies ?? {}),
            ...Object.keys(parsed.devDependencies ?? {}),
            ...Object.keys(parsed.peerDependencies ?? {}),
        ];

        return [...new Set(
            dependencyNames
                .map((dependencyName) => PACKAGE_SKILL_MAP[dependencyName])
                .filter((skill): skill is string => typeof skill === "string"),
        )];
    } catch {
        return [];
    }
};

export const extractManifestSkills = (manifestPath: string, manifestContent: string): string[] => {
    const regexSkills = MANIFEST_SKILL_PATTERNS
        .filter(({ pattern }) => pattern.test(manifestContent))
        .map(({ skill }) => skill);

    if (manifestPath !== "package.json") {
        return regexSkills;
    }

    return [...new Set([...regexSkills, ...parsePackageJsonSkills(manifestContent)])];
};

export const inferRootFileSkills = (paths: string[]): string[] =>
    paths.flatMap((path) =>
        ROOT_FILE_SKILL_PATTERNS
            .filter(({ pattern }) => pattern.test(getFileNameFromPath(path)))
            .map(({ skill }) => skill),
    );

export const findManifestPaths = (paths: string[]): string[] =>
    paths.filter((path) => MANIFEST_PATHS.includes(getFileNameFromPath(path) as typeof MANIFEST_PATHS[number]))
        .slice(0, MAX_MANIFEST_FILES_PER_REPOSITORY);

export const getPrimaryEmail = (emails: GithubUserEmail[]): string | undefined => {
    const primary = emails.find((email) => email.primary && email.verified);
    if (primary) {
        return primary.email;
    }

    const verified = emails.find((email) => email.verified);
    if (verified) {
        return verified.email;
    }

    return emails[0]?.email;
};

export const processAvatar = async (userId: string, avatarUrl: string): Promise<string | undefined> => {
    try {
        const response = await fetch(avatarUrl);
        if (!response.ok) {
            return undefined;
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        const extension = getAvatarExtension(contentType);
        const buffer = Buffer.from(await response.arrayBuffer());
        return await uploadAvatarToS3(userId, buffer, contentType, extension);
    } catch (error) {
        console.error("Failed to process and upload avatar", error);
        return undefined;
    }
};
