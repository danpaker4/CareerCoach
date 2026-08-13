import type { MultipartFile } from "@fastify/multipart";

export const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024;

export const validateBirthDate = (birthDate: string): void => {
  const parsedBirthDate = new Date(`${birthDate}T00:00:00.000Z`);
  const today = new Date();
  const todayAtMidnightUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const isInvalidDate = Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate.toISOString().slice(0, 10) !== birthDate;

  if (isInvalidDate || parsedBirthDate.getTime() > todayAtMidnightUtc) {
    throw new Error("Birth date cannot be in the future");
  }
};

export const validatePdfFile = (cvFile: MultipartFile | null): void => {
  if (!cvFile) {
    return;
  }
  if (cvFile.mimetype !== "application/pdf") {
    throw new Error("CV file must be a PDF");
  }
};

export const throwIfUserAlreadyExists = (exists: boolean): void => {
  if (exists) {
    throw new Error("Email already exists");
  }
};

export const validateCvBuffer = (cvBuffer: Buffer): void => {
  if (cvBuffer.length === 0) {
    throw new Error("CV file is empty");
  }
  if (cvBuffer.length > MAX_CV_SIZE_BYTES) {
    throw new Error("CV file is too large");
  }
};
