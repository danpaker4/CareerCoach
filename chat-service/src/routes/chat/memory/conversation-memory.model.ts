import { ObjectId } from "mongodb";
import type { ConversationMemory } from "./conversation-memory.types";

export type ConversationMemoryDocument = ConversationMemory & {
    _id?: ObjectId;
};
