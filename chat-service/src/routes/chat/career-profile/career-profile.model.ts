import { ObjectId } from "mongodb";
import type { UserCareerProfile } from "./career-profile.types";

export type UserCareerProfileDocument = UserCareerProfile & {
    _id?: ObjectId;
};
