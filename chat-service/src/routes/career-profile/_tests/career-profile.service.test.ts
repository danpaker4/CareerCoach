import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Collection } from "mongodb";
import type { EmbeddingPort } from "../../../ai/embedding/embedding.types";
import { CareerProfileDal } from "../dal/career-profile.dal";
import { CareerProfileService } from "../career-profile.service";
import type { UserCareerProfileDocument } from "../career-profile.types";

type ProfileUpdate = {
    readonly $set?: Partial<UserCareerProfileDocument>;
    readonly $setOnInsert?: Partial<UserCareerProfileDocument>;
};

const createProfileCollection = (): Collection<UserCareerProfileDocument> => {
    const state: { document: UserCareerProfileDocument | null } = { document: null };
    return {
        findOne: async () => state.document,
        updateOne: async (_filter: { readonly userId: string }, update: ProfileUpdate) => {
            state.document = {
                ...(state.document ?? {}),
                ...(update.$setOnInsert ?? {}),
                ...(update.$set ?? {}),
            } as UserCareerProfileDocument;
            return {
                acknowledged: true,
                matchedCount: state.document ? 1 : 0,
                modifiedCount: 1,
                upsertedCount: 0,
                upsertedId: null,
            };
        },
    } as unknown as Collection<UserCareerProfileDocument>;
};

const embedding: EmbeddingPort = {
    embedText: async () => [],
    embedJob: async () => [],
    embedCareerProfile: async () => [],
    embedCareerDirection: async () => [],
};

describe("CareerProfileService", () => {
    it("maps structured profile fields without invoking the chat LLM", async () => {
        const service = new CareerProfileService(
            new CareerProfileDal(createProfileCollection()),
            embedding
        );

        const profile = await service.updateProfileFromInput("profile-latency-user", {
            currentJob: "Backend Developer",
            technologies: ["TypeScript", "MongoDB"],
            interests: ["Performance"],
            githubSkills: ["Node.js"],
            knownSkills: ["RabbitMQ"],
        });

        assert.deepEqual(
            profile.technologies.map((signal) => signal.value),
            ["TypeScript", "MongoDB", "Node.js", "RabbitMQ"]
        );
        assert.deepEqual(profile.interests.map((signal) => signal.value), ["Performance"]);
    });
});
