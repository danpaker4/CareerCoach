import type { MultipartFile } from "@fastify/multipart";

export type RegisterUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  birthDate: string;
  currentJob?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  cvFile: MultipartFile | null;
};
