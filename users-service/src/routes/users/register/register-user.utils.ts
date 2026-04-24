import type { MultipartFile } from "@fastify/multipart";

export const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024;

export const ensurePdfFile = (cvFile: MultipartFile | null): void => {
  if (!cvFile) {
    throw new Error("CV file is required");
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
