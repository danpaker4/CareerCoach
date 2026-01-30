import { z } from "zod";

export const AchievementSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  grade: z.number()
});

export const UserSchema = z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    password: z.string(),
    birthDate: z.date(),
    currentJob: z.string().optional(),
    linkedInUrl: z.string().optional(),
    cv: z.string().optional(),
    achievements: z.array(AchievementSchema)
});

export type User = z.infer<typeof UserSchema>;
