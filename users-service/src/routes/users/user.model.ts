import { z } from "zod";

export const UserRoleSchema = z.enum(["user", "admin"]);

export const RoleSeniorityLevelSchema = z.enum(["junior", "mid", "senior", "lead"]);

export const RoleExperienceSourceSchema = z.enum(["cv", "chat", "job_interaction", "llm_inference"]);

export const RoleExperienceEntrySchema = z.object({
    roleKey: z.string().min(1),
    displayLabel: z.string().min(1),
    years: z.number().min(0),
    level: RoleSeniorityLevelSchema,
    evidence: z.array(z.string()).default([]),
    source: RoleExperienceSourceSchema.default("llm_inference"),
    updatedAt: z.coerce.date(),
});

export const UserSchema = z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    role: UserRoleSchema.default("user"),
    password: z.string().optional(),
    birthDate: z.date().optional(),
    achievements: z.array(z.object({
        id: z.uuid(),
        name: z.string(),
        grade: z.number().min(1).max(100),
    })).default([]),
    technologies: z.array(z.string()).default([]),
    interests: z.array(z.string()).default([]),
    knownSkills: z.array(z.string()).default([]),
    roleExperience: z.array(RoleExperienceEntrySchema).default([]),
    currentJob: z.string().nullish(),
    linkedInUrl: z.string().nullish(),
    githubUrl: z.string().nullish(),
    githubSkills: z.array(z.string()).default([]),
    cv: z.string().nullish(),
    githubId: z.number().nullish(),
    avatarUrl: z.string().nullish(),
    bio: z.string().nullish(),
    location: z.string().nullish(),
    company: z.string().nullish(),
    /** Set when chat-service first creates the linked `userCareerProfiles` document for this `id`. */
    coachProfileMaterializedAt: z.coerce.date().optional(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type RoleExperienceEntry = z.infer<typeof RoleExperienceEntrySchema>;
export type User = z.infer<typeof UserSchema>;
export type UserDocument = Omit<User, "id" | "role"> & { _id: string; role?: UserRole };
