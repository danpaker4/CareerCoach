import type { EnrichedJob } from "../poller/job-poller-api-stack/stages/enrich/types";
import { buildSearchableText } from "../poller/job-poller-api-stack/stages/enrich/embedding";
import { JobSeedSchema } from "./job-seed.schema";
import type { JobSeed } from "./job-seed.types";

const readStrings = (values: readonly string[] | undefined): readonly string[] => values ?? [];

export const toJobSeed = (job: EnrichedJob): JobSeed => {
    const requirements = readStrings(job.requirements);
    const benefits = readStrings(job.benefits);
    const languages = readStrings(job.languages);
    const frameworks = readStrings(job.frameworks);
    const databases = readStrings(job.databases);
    const platforms = readStrings(job.platforms);
    const tools = readStrings(job.tools);
    const mustKnowSkills = readStrings(job.mustKnowSkills);
    const niceToHaveSkills = readStrings(job.niceToHaveSkills);
    const searchableText = job.searchableText?.trim() || buildSearchableText({
        jobTitle: job.jobTitle,
        description: job.description,
        requirements,
        benefits,
        languages,
        frameworks,
        databases,
        platforms,
        tools,
        mustKnowSkills,
        niceToHaveSkills,
    });

    return JobSeedSchema.parse({
        id: job.id,
        jobTitle: job.jobTitle,
        url: job.url,
        company: job.company,
        seniority: job.seniority,
        description: job.description,
        ...(job.location?.trim() ? { location: job.location } : {}),
        lon: job.lon,
        lat: job.lat,
        salary: job.salary ?? 0,
        requirements,
        benefits,
        languages,
        frameworks,
        databases,
        platforms,
        tools,
        mustKnowSkills,
        niceToHaveSkills,
        searchableText,
    });
};

export const toSeededJob = (seed: JobSeed): EnrichedJob => ({
    ...seed,
    requirements: [...seed.requirements],
    benefits: [...seed.benefits],
    languages: [...seed.languages],
    frameworks: [...seed.frameworks],
    databases: [...seed.databases],
    platforms: [...seed.platforms],
    tools: [...seed.tools],
    mustKnowSkills: [...seed.mustKnowSkills],
    niceToHaveSkills: [...seed.niceToHaveSkills],
    searchEmbedding: [],
});
