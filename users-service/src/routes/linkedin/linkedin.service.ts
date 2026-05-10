import type { Collection } from "mongodb";
import { randomUUID } from "crypto";
import { getLinkedInConfig } from "./linkedin.config";
import type { LinkedInUserProfile } from "./linkedin.types";
import type { User } from "../users/user.model";
import { buildAuthenticatedSession } from "../auth/auth.service";
import type { AuthenticatedUserSession } from "../auth/auth.types";
import { toSafeUser } from "../auth/auth.utils";

export const exchangeLinkedInCodeForToken = async (code: string, redirectUri: string): Promise<string> => {
    const config = getLinkedInConfig();

    const params = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: config.LINKEDIN_CLIENT_ID,
        client_secret: config.LINKEDIN_CLIENT_SECRET,
    });

    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    if (!response.ok) {
        throw new Error(`Failed to exchange LinkedIn code: ${response.statusText}`);
    }

    const data = await response.json() as { access_token?: string };
    if (!data.access_token) {
        throw new Error("No access token returned from LinkedIn");
    }

    return data.access_token;
};

export const fetchLinkedInUserProfile = async (accessToken: string): Promise<LinkedInUserProfile> => {
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch LinkedIn user profile");
    }

    return response.json() as Promise<LinkedInUserProfile>;
};

export const loginOrCreateLinkedInUser = async (
    usersCollection: Collection<User>,
    profile: LinkedInUserProfile,
): Promise<AuthenticatedUserSession> => {
    const emailLower = profile.email.toLowerCase();

    let user = await usersCollection.findOne({ email: emailLower });

    let finalUser: User;

    if (user) {
        const updates: Partial<User> = {
            linkedInUrl: `https://www.linkedin.com/in/${profile.sub}`,
            avatarUrl: user.avatarUrl ?? profile.picture,
        };
        await usersCollection.updateOne({ id: user.id }, { $set: updates });
        finalUser = { ...user, ...updates } as User;
    } else {
        const newUser: User = {
            id: randomUUID(),
            firstName: profile.given_name,
            lastName: profile.family_name,
            email: emailLower,
            achievements: [],
            linkedInUrl: `https://www.linkedin.com/in/${profile.sub}`,
            avatarUrl: profile.picture,
        };
        await usersCollection.insertOne(newUser);
        finalUser = newUser;
    }

    return buildAuthenticatedSession(toSafeUser(finalUser));
};
