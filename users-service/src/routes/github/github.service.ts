import type { Collection } from "mongodb";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { getGithubConfig } from "./github.config";
import {
    MAX_MANIFEST_REPOSITORIES_TO_ANALYZE,
    REPOSITORY_LIST_PER_PAGE,
} from "./github.consts";
import type {
    GithubContentFileResponse,
    GithubRepository,
    GithubRepositoryLanguages,
    GithubTokenErrorResponse,
    GithubTokenResponse,
    GithubTreeResponse,
    GithubUserEmail,
    GithubUserProfile,
} from "./github.types";
import type { User, UserDocument } from "../users/user.model";
import { toUserDocument } from "../users/user.utils";
import { buildAuthenticatedSession } from "../auth/auth.service";
import type { AuthenticatedUserSession } from "../auth/auth.types";
import { toSafeUser } from "../auth/auth.utils";
import {
    buildGithubRequestInit,
    buildGithubSkillList,
    extractManifestSkills,
    findManifestPaths,
    getFileNameFromPath,
    getPrimaryEmail,
    inferRootFileSkills,
    processAvatar,
    rankRepositoriesForAnalysis,
} from "./github.utils";

export const exchangeCodeForAccessToken = async (code: string, redirectUri: string): Promise<string> => {
    const config = getGithubConfig();
    const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            client_id: config.GITHUB_CLIENT_ID,
            client_secret: config.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to exchange code: ${response.statusText}`);
    }

    const data = await response.json() as GithubTokenResponse & GithubTokenErrorResponse;
    if (!data.access_token) {
        console.error("GitHub token exchange failed. Response from GitHub:", JSON.stringify(data, null, 2));
        throw new Error(`No access token returned from GitHub: ${data.error_description || data.error || 'Unknown error'}`);
    }

    return data.access_token;
};

export const fetchGithubUserProfile = async (accessToken: string): Promise<GithubUserProfile> => {
    const response = await fetch("https://api.github.com/user", buildGithubRequestInit(accessToken));

    if (!response.ok) {
        const body = await response.text().catch(() => "no body");
        console.error("Failed to fetch user profile from GitHub. Status:", response.status, "Body:", body);
        throw new Error("Failed to fetch user profile from GitHub");
    }

    return response.json() as Promise<GithubUserProfile>;
};

export const fetchGithubUserEmails = async (accessToken: string): Promise<GithubUserEmail[]> => {
    const response = await fetch("https://api.github.com/user/emails", buildGithubRequestInit(accessToken));

    if (!response.ok) {
        const body = await response.text().catch(() => "no body");
        console.error("Failed to fetch user emails from GitHub. Status:", response.status, "Body:", body);
        throw new Error("Failed to fetch user emails from GitHub");
    }

    return response.json() as Promise<GithubUserEmail[]>;
};

const fetchGithubUserRepositories = async (accessToken: string): Promise<GithubRepository[]> => {
    const response = await fetch(
        `https://api.github.com/user/repos?per_page=${REPOSITORY_LIST_PER_PAGE}&visibility=all&affiliation=owner&sort=updated`,
        buildGithubRequestInit(accessToken),
    );

    if (!response.ok) {
        const body = await response.text().catch(() => "no body");
        console.error("Failed to fetch GitHub repositories. Status:", response.status, "Body:", body);
        throw new Error("Failed to fetch GitHub repositories");
    }

    return response.json() as Promise<GithubRepository[]>;
};

const fetchGithubRepositoryLanguages = async (
    accessToken: string,
    languagesUrl: string,
): Promise<GithubRepositoryLanguages> => {
    const response = await fetch(languagesUrl, buildGithubRequestInit(accessToken));

    if (!response.ok) {
        const body = await response.text().catch(() => "no body");
        console.error("Failed to fetch GitHub repository languages. Status:", response.status, "Body:", body);
        return {};
    }

    return response.json() as Promise<GithubRepositoryLanguages>;
};

const fetchGithubRepositoryFileContent = async (
    accessToken: string,
    owner: string,
    repositoryName: string,
    path: string,
): Promise<string | null> => {
    const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}/contents/${path}`,
        buildGithubRequestInit(accessToken),
    );

    if (response.status === StatusCodes.NOT_FOUND) {
        return null;
    }

    if (!response.ok) {
        const body = await response.text().catch(() => "no body");
        console.error("Failed to fetch GitHub repository file content. Status:", response.status, "Body:", body);
        return null;
    }

    const file = await response.json() as GithubContentFileResponse;
    if (file.type !== "file" || file.encoding !== "base64" || !file.content) {
        return null;
    }

    return Buffer.from(file.content, "base64").toString("utf-8");
};

const fetchGithubRepositoryTree = async (
    accessToken: string,
    owner: string,
    repositoryName: string,
): Promise<string[]> => {
    const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}/git/trees/HEAD?recursive=1`,
        buildGithubRequestInit(accessToken),
    );

    if (response.status === StatusCodes.NOT_FOUND) {
        return [];
    }

    if (!response.ok) {
        const body = await response.text().catch(() => "no body");
        console.error("Failed to fetch GitHub repository tree. Status:", response.status, "Body:", body);
        return [];
    }

    const treeResponse = await response.json() as GithubTreeResponse;
    return (treeResponse.tree ?? [])
        .filter((entry) => entry.type === "blob")
        .map((entry) => entry.path);
};

const fetchGithubRepositoryManifestSkills = async (
    accessToken: string,
    repositories: GithubRepository[],
): Promise<string[]> => {
    const repositoriesToInspect = repositories.slice(0, MAX_MANIFEST_REPOSITORIES_TO_ANALYZE);
    const repositoryTrees = await Promise.all(
        repositoriesToInspect.map((repository) =>
            fetchGithubRepositoryTree(accessToken, repository.owner.login, repository.name),
        ),
    );
    const manifestResults = await Promise.all(
        repositoriesToInspect.flatMap((repository, repositoryIndex) =>
            findManifestPaths(repositoryTrees[repositoryIndex] ?? []).map(async (path) => ({
                manifestPath: getFileNameFromPath(path),
                content: await fetchGithubRepositoryFileContent(
                    accessToken,
                    repository.owner.login,
                    repository.name,
                    path,
                ),
            })),
        ),
    );
    return [...new Set(
        [
            ...manifestResults
                .flatMap((result) =>
                    typeof result.content === "string" && result.content.length > 0
                        ? extractManifestSkills(result.manifestPath, result.content)
                        : [],
                ),
            ...repositoryTrees.flatMap((paths) => inferRootFileSkills(paths)),
        ],
    )];
};

export const extractGithubSkills = async (accessToken: string): Promise<string[]> => {
    try {
        const repositories = await fetchGithubUserRepositories(accessToken);
        const repositoriesToAnalyze = rankRepositoriesForAnalysis(repositories);
        const repositoryLanguages = await Promise.all(
            repositoriesToAnalyze.map((repository) =>
                fetchGithubRepositoryLanguages(accessToken, repository.languages_url),
            ),
        );
        const manifestSkills = await fetchGithubRepositoryManifestSkills(accessToken, repositoriesToAnalyze);

        return buildGithubSkillList(repositoriesToAnalyze, repositoryLanguages, manifestSkills);
    } catch (error) {
        console.error("Failed to extract GitHub skills", error);
        return [];
    }
};

export const loginOrCreateGithubUser = async (
    usersCollection: Collection<UserDocument>,
    accessToken: string,
    githubProfile: GithubUserProfile,
    emails: GithubUserEmail[]
): Promise<AuthenticatedUserSession> => {
    const email = getPrimaryEmail(emails);
    if (!email) {
        throw new Error("No email found in GitHub profile");
    }

    const emailLower = email.toLowerCase();
    const user = await usersCollection.findOne({
        $or: [
            { githubId: githubProfile.id },
            { email: emailLower },
        ],
    });

    const [firstName, ...lastNameParts] = (githubProfile.name || githubProfile.login).split(" ");
    const lastName = lastNameParts.join(" ") || " ";
    const extractedSkills = await extractGithubSkills(accessToken);
    const finalUser = user
        ? await (async (): Promise<UserDocument> => {
            const processedAvatarUrl = !user.avatarUrl && githubProfile.avatar_url
                ? await processAvatar(user._id, githubProfile.avatar_url)
                : undefined;
            const updates: Partial<Omit<UserDocument, "_id">> = {
                githubId: githubProfile.id,
                githubUrl: githubProfile.html_url,
                avatarUrl: processedAvatarUrl || user.avatarUrl,
                githubSkills: extractedSkills.length > 0 ? extractedSkills : (user.githubSkills ?? []),
                ...(githubProfile.bio && !user.bio ? { bio: githubProfile.bio } : {}),
                ...(githubProfile.location && !user.location ? { location: githubProfile.location } : {}),
                ...(githubProfile.company && !user.company ? { company: githubProfile.company } : {}),
            };

            await usersCollection.updateOne({ _id: user._id }, { $set: updates });
            return { ...user, ...updates };
        })()
        : await (async (): Promise<UserDocument> => {
            const userId = randomUUID();
            const avatarUrl = githubProfile.avatar_url
                ? await processAvatar(userId, githubProfile.avatar_url)
                : undefined;
            const newUser: User = {
                id: userId,
                firstName,
                lastName,
                email: emailLower,
                achievements: [],
                githubSkills: extractedSkills,
                githubId: githubProfile.id,
                githubUrl: githubProfile.html_url,
                bio: githubProfile.bio || undefined,
                location: githubProfile.location || undefined,
                company: githubProfile.company || undefined,
                avatarUrl,
            };

            const userDocument = toUserDocument(newUser);
            await usersCollection.insertOne(userDocument);
            return userDocument;
        })();

    return buildAuthenticatedSession(toSafeUser(finalUser));
};
