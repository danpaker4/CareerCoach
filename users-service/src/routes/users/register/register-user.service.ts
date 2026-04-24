import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import type { Collection } from "mongodb";
import type { MultipartFile } from "@fastify/multipart";
import type { User } from "../user.model";
import { extractTextFromCv } from "../../cv/cv-parser.service";
import { extractAchievementsWithGemini } from "../../cv/enrich-with-gemini/gemini.service";
import { uploadCvToS3 } from "../../cv/s3-upload/s3-upload.service";
import type { RegisterUserInput } from "./register-user.types";
import {
  ensurePdfFile,
  throwIfUserAlreadyExists,
  validateCvBuffer,
} from "./register-user.utils";

export const registerUser = async (
  usersCollection: Collection<User>,
  input: RegisterUserInput,
): Promise<Omit<User, "password">> => {
  const { firstName, lastName, email, password, birthDate, currentJob, linkedInUrl, githubUrl } = input;

  if (!email || !password || !firstName || !lastName || !birthDate) {
    throw new Error("Missing required fields");
  }

  ensurePdfFile(input.cvFile);
  const cvFile = input.cvFile as MultipartFile;

  const existingUser = await usersCollection.findOne({ email });
  throwIfUserAlreadyExists(Boolean(existingUser));

  const cvBuffer = await cvFile.toBuffer();
  validateCvBuffer(cvBuffer);

  const userId = uuidv4();
  const cvS3Path = await uploadCvToS3(userId, cvBuffer);
  const cvText = await extractTextFromCv(cvBuffer);
  const achievementsFromGemini = await extractAchievementsWithGemini({
    cvText,
    currentJob,
    linkedInUrl,
    githubUrl,
  });

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
    cv: cvS3Path,
    achievements: achievementsFromGemini.map((achievement) => ({
      id: uuidv4(),
      name: achievement.name,
      grade: achievement.grade,
    })),
  };

  await usersCollection.insertOne(newUser);

  const { password: _password, ...safeUser } = newUser;
  return safeUser;
};
