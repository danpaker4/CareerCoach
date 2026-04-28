import type { Collection } from "mongodb";
import { randomUUID } from "crypto";
import { getGithubConfig } from "./github.config";
import type { GithubTokenResponse, GithubUserEmail, GithubUserProfile } from "./github.types";
import type { User } from "../users/user.model";
import { buildAuthenticatedSession } from "../auth/auth.service";
import type { AuthenticatedUserSession } from "../auth/auth.types";
import { toSafeUser } from "../auth/auth.utils";
import { uploadAvatarToS3 } from "../cv/s3-upload/s3-upload.service";

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

    const data = await response.json() as any;
    if (!data.access_token) {
        console.error("GitHub token exchange failed. Response from GitHub:", JSON.stringify(data, null, 2));
        throw new Error(`No access token returned from GitHub: ${data.error_description || data.error || 'Unknown error'}`);
    }

    return data.access_token;
};

export const fetchGithubUserProfile = async (accessToken: string): Promise<GithubUserProfile> => {
    const response = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "CareerCoach-App",
        },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "no body");
        console.error("Failed to fetch user profile from GitHub. Status:", response.status, "Body:", body);
        throw new Error("Failed to fetch user profile from GitHub");
    }

    return response.json() as Promise<GithubUserProfile>;
};

export const fetchGithubUserEmails = async (accessToken: string): Promise<GithubUserEmail[]> => {
    const response = await fetch("https://api.github.com/user/emails", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "CareerCoach-App",
        },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "no body");
        console.error("Failed to fetch user emails from GitHub. Status:", response.status, "Body:", body);
        throw new Error("Failed to fetch user emails from GitHub");
    }

    return response.json() as Promise<GithubUserEmail[]>;
};

const getPrimaryEmail = (emails: GithubUserEmail[]): string | undefined => {
    const primary = emails.find(e => e.primary && e.verified);
    if (primary) return primary.email;
    const verified = emails.find(e => e.verified);
    if (verified) return verified.email;
    return emails[0]?.email;
};

const processAvatar = async (userId: string, avatarUrl: string): Promise<string | undefined> => {
    try {
        const response = await fetch(avatarUrl);
        if (!response.ok) return undefined;
        
        const contentType = response.headers.get("content-type") || "image/jpeg";
        let extension = "jpg";
        if (contentType === "image/png") extension = "png";
        if (contentType === "image/gif") extension = "gif";
        if (contentType === "image/webp") extension = "webp";

        const buffer = Buffer.from(await response.arrayBuffer());
        return await uploadAvatarToS3(userId, buffer, contentType, extension);
    } catch (e) {
        console.error("Failed to process and upload avatar", e);
        return undefined;
    }
};

export const loginOrCreateGithubUser = async (
    usersCollection: Collection<User>,
    githubProfile: GithubUserProfile,
    emails: GithubUserEmail[]
): Promise<AuthenticatedUserSession> => {
    const email = getPrimaryEmail(emails);
    if (!email) {
        throw new Error("No email found in GitHub profile");
    }

    const emailLower = email.toLowerCase();
    
    // Check if user exists by githubId or email
    let user = await usersCollection.findOne({ 
        $or: [
            { githubId: githubProfile.id },
            { email: emailLower }
        ] 
    });

    const [firstName, ...lastNameParts] = (githubProfile.name || githubProfile.login).split(" ");
    const lastName = lastNameParts.join(" ") || " "; // fallback if no last name

    let finalUser: User;

    if (user) {
        // Upsert avatar if user doesn't have one and github profile does
        let avatarUrl = user.avatarUrl;
        if (!avatarUrl && githubProfile.avatar_url) {
             avatarUrl = await processAvatar(user.id, githubProfile.avatar_url);
        }

        const updates: Partial<User> = {
            githubId: githubProfile.id,
            githubUrl: githubProfile.html_url,
            avatarUrl: avatarUrl || user.avatarUrl,
        };

        if (githubProfile.bio && !user.bio) updates.bio = githubProfile.bio;
        if (githubProfile.location && !user.location) updates.location = githubProfile.location;
        if (githubProfile.company && !user.company) updates.company = githubProfile.company;

        await usersCollection.updateOne({ id: user.id }, { $set: updates });
        finalUser = { ...user, ...updates } as User;
    } else {
        const userId = randomUUID();
        let avatarUrl: string | undefined = undefined;
        
        if (githubProfile.avatar_url) {
             avatarUrl = await processAvatar(userId, githubProfile.avatar_url);
        }

        const newUser: User = {
            id: userId,
            firstName,
            lastName,
            email: emailLower,
            achievements: [],
            githubId: githubProfile.id,
            githubUrl: githubProfile.html_url,
            bio: githubProfile.bio || undefined,
            location: githubProfile.location || undefined,
            company: githubProfile.company || undefined,
            avatarUrl,
        };

        await usersCollection.insertOne(newUser);
        finalUser = newUser;
    }

    return buildAuthenticatedSession(toSafeUser(finalUser));
};
