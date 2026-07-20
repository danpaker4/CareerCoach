import type { Collection } from "mongodb";
import type { EmbeddingPort } from "../../../ai/embedding/embedding.types";

export type CareerDirectionExample = {
    directionName: string;
    description: string;
    exampleRoles: string[];
    exampleTasks: string[];
    relatedSkills: string[];
    embedding: number[];
    sourceJobIds: string[];
    createdAt: Date;
    updatedAt: Date;
};

export type CareerDirectionSuggestion = {
    directionName: string;
    why: string;
    exampleRoles: string[];
};

export type SuggestDirectionsDeps = {
    readonly directionCollection: Collection<CareerDirectionExample>;
    readonly embedding: EmbeddingPort;
    readonly directionVectorIndexName: string;
};
