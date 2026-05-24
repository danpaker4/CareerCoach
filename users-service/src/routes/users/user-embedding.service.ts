import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Collection } from "mongodb";
import type { User, UserDocument } from "./user.model";
import { toUser } from "./user.utils";

const EMBEDDING_MODELS = ["text-embedding-004", "gemini-embedding-001", "embedding-001"] as const;

let genAIInstance: GoogleGenerativeAI | null = null;

const getGenAI = (apiKey: string): GoogleGenerativeAI => {
    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(apiKey);
    }
    return genAIInstance;
};

export const buildUserProfileText = (user: User): string => {
    const sections: string[] = [];

    if (user.currentJob) {
        sections.push(`Current role: ${user.currentJob}`);
    }
    if (user.dreamJob) {
        sections.push(`Target role: ${user.dreamJob}`);
    }

    const allSkills = [...new Set([
        ...(user.knownSkills ?? []),
        ...(user.technologies ?? []),
        ...(user.githubSkills ?? []),
    ])].filter(Boolean);

    if (allSkills.length > 0) {
        sections.push(`Skills and technologies: ${allSkills.join(", ")}`);
    }
    if (user.interests && user.interests.length > 0) {
        sections.push(`Interests: ${user.interests.join(", ")}`);
    }
    if (user.roleExperience && user.roleExperience.length > 0) {
        const expLines = user.roleExperience.map(
            (r) => `${r.displayLabel} (${r.level}, ${r.years} years)`
        );
        sections.push(`Experience: ${expLines.join(", ")}`);
    }
    if (user.achievements && user.achievements.length > 0) {
        const achievementNames = user.achievements.map((a) => a.name);
        sections.push(`Achievements: ${achievementNames.join(", ")}`);
    }

    return sections.join("\n");
};

export const generateProfileEmbedding = async (
    profileText: string,
    apiKey: string
): Promise<number[]> => {
    const genAI = getGenAI(apiKey);

    for (const modelName of EMBEDDING_MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.embedContent(profileText);
            const values = result.embedding?.values;
            if (Array.isArray(values) && values.length > 0) return values;
        } catch (error) {
            const status = (error as { status?: number }).status;
            if (status === 404) continue;
            throw error;
        }
    }
    throw new Error("All embedding models failed");
};

export const regenerateProfileEmbedding = async (
    usersCollection: Collection<UserDocument>,
    userId: string
): Promise<void> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;

    const userDoc = await usersCollection.findOne({ _id: userId });
    if (!userDoc) return;

    const user = toUser(userDoc);
    const profileText = buildUserProfileText(user);
    if (!profileText.trim()) return;

    const embedding = await generateProfileEmbedding(profileText, apiKey);
    await usersCollection.updateOne(
        { _id: userId },
        { $set: { profileEmbedding: embedding, profileEmbeddingUpdatedAt: new Date() } }
    );
};
