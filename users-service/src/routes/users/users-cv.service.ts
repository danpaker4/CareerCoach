import { randomUUID } from "crypto";
import type { Collection } from "mongodb";
import { extractTextFromCv } from "../cv/cv-parser.service";
import { extractAchievementsWithGemini } from "../cv/enrich-with-gemini/gemini.service";
import { uploadCvToS3 } from "../cv/s3-upload/s3-upload.service";
import type { User, UserDocument } from "./user.model";
import { toUser } from "./user.utils";
import type { UpdateUserCvInput } from "./users-cv.types";
import { validateCvBuffer, validatePdfFile } from "./register/register-user.utils";

const resolveProfileValue = (nextValue: string | undefined, currentValue: string | null | undefined): string | undefined => {
    const trimmedValue = nextValue?.trim();
    return trimmedValue ? trimmedValue : currentValue ?? undefined;
};

export const updateUserCv = async (
    usersCollection: Collection<UserDocument>,
    input: UpdateUserCvInput,
): Promise<Omit<User, "password"> | null> => {
    const existingUser = await usersCollection.findOne({ _id: input.userId });
    if (!existingUser) {
        return null;
    }

    validatePdfFile(input.cvFile);

    const cvBuffer = await input.cvFile.toBuffer();
    validateCvBuffer(cvBuffer);

    const currentUser = toUser(existingUser);
    const cv = await uploadCvToS3(input.userId, cvBuffer);
    const cvText = await extractTextFromCv(cvBuffer);
    const achievements = await extractAchievementsWithGemini({
        cvText,
        currentJob: resolveProfileValue(input.currentJob, currentUser.currentJob),
        linkedInUrl: resolveProfileValue(input.linkedInUrl, currentUser.linkedInUrl),
        githubUrl: resolveProfileValue(input.githubUrl, currentUser.githubUrl),
    });

    const nextAchievements = achievements.map((achievement) => ({
        id: randomUUID(),
        name: achievement.name,
        grade: achievement.grade,
    }));

    await usersCollection.updateOne(
        { _id: input.userId },
        {
            $set: {
                cv,
                achievements: nextAchievements,
            },
        },
    );

    const { password: _password, ...safeUser } = currentUser;

    return {
        ...safeUser,
        cv,
        achievements: nextAchievements,
    };
};
