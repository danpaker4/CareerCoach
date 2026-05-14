import { ObjectId } from "mongodb";

export const tryParseConversationObjectId = (value: string): ObjectId | null =>
    ObjectId.isValid(value) ? new ObjectId(value) : null;
