import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { Collection } from "mongodb";
import type { User, UserDocument } from "../user.model";
import { toUserDocument } from "../user.utils";
import { extractTextFromCv } from "../../cv/cv-parser.service";
import { extractAchievementsWithGemini } from "../../cv/enrich-with-gemini/gemini.service";
import { uploadCvToS3 } from "../../cv/s3-upload/s3-upload.service";
import type { RegisterUserInput } from "./register-user.types";
import {
  throwIfUserAlreadyExists,
  validatePdfFile,
  validateCvBuffer,
} from "./register-user.utils";

export const registerUser = async (
  usersCollection: Collection<UserDocument>,
  input: RegisterUserInput,
): Promise<Omit<User, "password">> => {
  const { firstName, lastName, email, password, birthDate, currentJob, linkedInUrl, githubUrl } = input;

  if (!email || !password || !firstName || !lastName || !birthDate) {
    throw new Error("Missing required fields");
  }

  const existingUser = await usersCollection.findOne({ email });
  throwIfUserAlreadyExists(Boolean(existingUser));

  const userId = randomUUID();
  const { cvFile } = input;
  validatePdfFile(cvFile);

  const { cvS3Path, achievementsFromGemini } = cvFile
    ? await (async () => {
      const cvBuffer = await cvFile.toBuffer();
      validateCvBuffer(cvBuffer);
      const uploadedCvS3Path = await uploadCvToS3(userId, cvBuffer);
      const cvText = await extractTextFromCv(cvBuffer);
      const extractedAchievements = await extractAchievementsWithGemini({
        cvText,
        currentJob,
        linkedInUrl,
        githubUrl,
      });
      return {
        cvS3Path: uploadedCvS3Path,
        achievementsFromGemini: extractedAchievements,
      };
    })()
    : { cvS3Path: undefined, achievementsFromGemini: [] };

  const hashedPassword = await bcrypt.hash(password, 10);
    const newUser: User = {
      id: userId,
      firstName,
      lastName,
      email,
    password: hashedPassword,
    birthDate: new Date(birthDate),
    currentJob: currentJob || undefined,
      linkedInUrl: linkedInUrl || undefined,
      githubUrl: githubUrl || undefined,
      githubSkills: [],
      cv: cvS3Path,
      achievements: achievementsFromGemini.map((achievement) => ({
        id: randomUUID(),
        name: achievement.name,
        grade: achievement.grade,
    })),
  };

  await usersCollection.insertOne(toUserDocument(newUser));

  const { password: _password, ...safeUser } = newUser;
  return safeUser;
};
