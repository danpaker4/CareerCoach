import { z } from "zod";

export const UserSchema = z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    password: z.string(),
    birthDate: z.date(),
    achievements: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        grade: z.number().min(1).max(100),
    })).default([]),
    currentJob: z.string().optional(),
    linkedInUrl: z.string().optional(),
    githubUrl: z.string().optional(),
    cv: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

