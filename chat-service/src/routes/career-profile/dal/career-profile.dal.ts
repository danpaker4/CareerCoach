import type { Collection } from "mongodb";
import type { UserCareerProfileDocument } from "../career-profile.model";

export class CareerProfileDal {
    constructor(private readonly collection: Collection<UserCareerProfileDocument>) { }

    findByUserId = async (userId: string): Promise<UserCareerProfileDocument | null> =>
        this.collection.findOne({ userId });

    upsertByUserId = async (profile: UserCareerProfileDocument): Promise<void> => {
        const { createdAt, ...settableProfile } = profile;
        await this.collection.updateOne(
            { userId: profile.userId },
            {
                $set: {
                    ...settableProfile,
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    createdAt,
                },
            },
            { upsert: true }
        );
    };
}
