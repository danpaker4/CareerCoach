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

const uniqueStrings = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];

const inferTechnologiesFromText = (text: string): string[] => {
  const normalized = text.toLowerCase();
  const map: Record<string, string> = {
    nodejs: "Node.js",
    "node.js": "Node.js",
    node: "Node.js",
    mongo: "MongoDB",
    mongodb: "MongoDB",
    typescript: "TypeScript",
    javascript: "JavaScript",
    react: "React",
    angular: "Angular",
    redis: "Redis",
    kafka: "Kafka",
    cypress: "Cypress",
    playwright: "Playwright",
    docker: "Docker",
    kubernetes: "Kubernetes",
    aws: "AWS",
  };

  const found = new Set<string>();
  for (const [needle, canonical] of Object.entries(map)) {
    if (normalized.includes(needle)) {
      found.add(canonical);
    }
  }
  return [...found];
};

const inferInterestsFromText = (text: string): string[] => {
  const normalized = text.toLowerCase();
  const candidates = [
    "automation",
    "testing",
    "backend",
    "frontend",
    "devops",
    "data",
    "analytics",
    "security",
    "reliability",
    "scalability",
    "product",
  ];
  return candidates.filter((candidate) => normalized.includes(candidate));
};

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
  const achievementTexts = achievementsFromGemini.map((achievement) => achievement.name);
  const cvSignalText = [currentJob ?? "", ...achievementTexts].join(" | ");
  const technologies = uniqueStrings(inferTechnologiesFromText(cvSignalText));
  const interests = uniqueStrings(inferInterestsFromText(cvSignalText));
  const newUser: User = {
    id: userId,
    firstName,
    lastName,
    email,
    role: "user",
    profileEmbedding: [],
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
    technologies,
    interests,
    knownSkills: technologies,
    roleExperience: [],
  };

  await usersCollection.insertOne(toUserDocument(newUser));

  const { password: _password, ...safeUser } = newUser;
  return safeUser;
};
