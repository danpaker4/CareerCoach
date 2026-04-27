import { z } from "zod";

export const UserSchema = z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    password: z.string().optional(),
    birthDate: z.date().optional(),
    achievements: z.array(z.object({
        id: z.uuid(),
        name: z.string(),
        grade: z.number().min(1).max(100),
    })).default([]),
    currentJob: z.string().nullish(),
    linkedInUrl: z.string().nullish(),
    githubUrl: z.string().nullish(),
    cv: z.string().nullish(),
    githubId: z.number().nullish(),
    avatarUrl: z.string().nullish(),
    bio: z.string().nullish(),
    location: z.string().nullish(),
    company: z.string().nullish(),
});

export type User = z.infer<typeof UserSchema>;
