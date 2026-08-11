import { z } from "zod";

const requiredString = z.string().trim().min(1);
const stringList = z.array(requiredString).default([]);

export const JobSeedSchema = z.object({
    id: requiredString,
    jobTitle: requiredString,
    url: z.string(),
    company: requiredString,
    seniority: requiredString,
    description: requiredString,
    location: requiredString.optional(),
    lon: z.number().finite().nullable(),
    lat: z.number().finite().nullable(),
    salary: z.number().finite().nonnegative().default(0),
    requirements: stringList,
    benefits: stringList,
    languages: stringList,
    frameworks: stringList,
    databases: stringList,
    platforms: stringList,
    tools: stringList,
    mustKnowSkills: stringList,
    niceToHaveSkills: stringList,
    searchableText: requiredString,
}).strict();

export const JobSeedListSchema = z.array(JobSeedSchema);

export const JobSeedEnvSchema = z.object({
    MONGO_CONNECTION_STRING: z.string().trim().min(1, "MONGO_CONNECTION_STRING is required"),
});
