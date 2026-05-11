import type { MultipartFile } from "@fastify/multipart";

export interface UpdateUserCvInput {
    userId: string;
    cvFile: MultipartFile;
    currentJob?: string;
    linkedInUrl?: string;
    githubUrl?: string;
}
