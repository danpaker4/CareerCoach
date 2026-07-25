import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "node:crypto";
import type { Collection } from "mongodb";
import type { User, UserDocument } from "./user.model";
import { getProfileEmbeddingConfig } from "./user-embedding.config";
import { toUser } from "./user.utils";

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
    apiKey: string,
    modelName: string,
): Promise<number[]> => {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
    const result = await model.embedContent(profileText);
    const values = result.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
        throw new Error(`Embedding model ${modelName} returned an empty vector`);
    }
    return values;
};

export const regenerateProfileEmbedding = async (
    usersCollection: Collection<UserDocument>,
    userId: string
): Promise<void> => {
    if (process.env.NODE_ENV === "test") return;
    const config = getProfileEmbeddingConfig();

    const userDoc = await usersCollection.findOne({ _id: userId });
    if (!userDoc) return;

    const user = toUser(userDoc);
    const profileText = buildUserProfileText(user);
    if (!profileText.trim()) return;

    if (!config.GEMINI_API_KEY) {
        await usersCollection.updateOne(
            { _id: userId },
            { $set: { profileEmbeddingStatus: "failed" } },
        );
        return;
    }

    const sourceHash = createHash("sha256").update(profileText).digest("hex");
    await usersCollection.updateOne(
        { _id: userId },
        {
            $set: {
                profileEmbeddingStatus: "pending",
                profileEmbeddingSourceHash: sourceHash,
            },
        },
    );

    try {
        const embedding = await generateProfileEmbedding(
            profileText,
            config.GEMINI_API_KEY,
            config.PROFILE_EMBEDDING_MODEL,
        );
        if (embedding.length !== config.PROFILE_EMBEDDING_DIMENSIONS) {
            throw new Error(
                `Profile embedding dimension ${embedding.length} does not match configured dimension ${config.PROFILE_EMBEDDING_DIMENSIONS}`,
            );
        }

        const latestUserDoc = await usersCollection.findOne({ _id: userId });
        if (!latestUserDoc) return;
        const latestProfileText = buildUserProfileText(toUser(latestUserDoc));
        const latestSourceHash = createHash("sha256").update(latestProfileText).digest("hex");
        if (latestSourceHash !== sourceHash) {
            await regenerateProfileEmbedding(usersCollection, userId);
            return;
        }

        await usersCollection.updateOne(
            { _id: userId, profileEmbeddingSourceHash: sourceHash },
            {
                $set: {
                    profileEmbedding: embedding,
                    profileEmbeddingUpdatedAt: new Date(),
                    profileEmbeddingModel: config.PROFILE_EMBEDDING_MODEL,
                    profileEmbeddingStatus: "ready",
                },
            },
        );
    } catch (error) {
        await usersCollection.updateOne(
            { _id: userId, profileEmbeddingSourceHash: sourceHash },
            { $set: { profileEmbeddingStatus: "failed" } },
        );
        throw error;
    }
};
