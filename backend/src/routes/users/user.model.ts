import { z } from "zod";

export const UserSchema = z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    password: z.string(),
    birthDate: z.date(),
    currentJob: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

