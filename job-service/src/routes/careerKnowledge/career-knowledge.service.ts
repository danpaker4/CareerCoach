import type { Collection } from "mongodb";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type { CareerDirectionExample, CareerPathProfile, CareerRoleProfile, CareerSkillProfile } from "./career-knowledge.types";

const toCounterObject = (values: readonly string[]): Record<string, number> =>
    values.reduce<Record<string, number>>((acc, item) => {
        const key = item.trim();
        if (!key) {
            return acc;
        }
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {});

export class CareerKnowledgeService {
    constructor(
        private readonly jobsCollection: Collection<EnrichedJob>,
        private readonly roleProfilesCollection: Collection<CareerRoleProfile>,
        private readonly skillProfilesCollection: Collection<CareerSkillProfile>,
        private readonly pathProfilesCollection: Collection<CareerPathProfile>,
        private readonly directionExamplesCollection: Collection<CareerDirectionExample>
    ) { }

    refreshKnowledge = async (): Promise<void> => {
        const jobs = await this.jobsCollection.find({}, { projection: { id: 1, jobTitle: 1, seniority: 1, requirements: 1, mustKnowSkills: 1, niceToHaveSkills: 1, description: 1 } }).toArray();
        const now = new Date();

        const roleProfiles: CareerRoleProfile[] = jobs.map((job) => ({
            roleName: job.jobTitle,
            commonSkills: [...new Set([...(job.mustKnowSkills ?? []), ...(job.requirements ?? [])])].slice(0, 20),
            relatedRoles: [],
            commonDomains: [],
            seniorityDistribution: toCounterObject([job.seniority]),
            sourceJobIds: [job.id],
            embedding: job.searchEmbedding ?? [],
            createdAt: now,
            updatedAt: now,
        }));

        const skillMap = new Map<string, CareerSkillProfile>();
        for (const job of jobs) {
            const role = job.jobTitle;
            const skills = [...new Set([...(job.mustKnowSkills ?? []), ...(job.languages ?? []), ...(job.frameworks ?? []), ...(job.databases ?? []), ...(job.platforms ?? []), ...(job.tools ?? [])])];
            for (const skill of skills) {
                const existing = skillMap.get(skill);
                if (!existing) {
                    skillMap.set(skill, {
                        skillName: skill,
                        relatedRoles: [role],
                        relatedSkills: skills.filter((value) => value !== skill).slice(0, 20),
                        demandScore: 1,
                        sourceJobIds: [job.id],
                        embedding: job.searchEmbedding ?? [],
                        createdAt: now,
                        updatedAt: now,
                    });
                    continue;
                }
                existing.relatedRoles = [...new Set([...existing.relatedRoles, role])];
                existing.relatedSkills = [...new Set([...existing.relatedSkills, ...skills.filter((value) => value !== skill)])].slice(0, 20);
                existing.demandScore += 1;
                existing.sourceJobIds = [...new Set([...existing.sourceJobIds, job.id])];
                existing.updatedAt = now;
            }
        }

        const directionExamples: CareerDirectionExample[] = roleProfiles.slice(0, 200).map((role) => ({
            directionName: role.roleName,
            description: `Direction based on real role data for ${role.roleName}.`,
            exampleRoles: [role.roleName],
            exampleTasks: role.commonSkills.slice(0, 5),
            relatedSkills: role.commonSkills.slice(0, 10),
            embedding: role.embedding,
            sourceJobIds: role.sourceJobIds,
            createdAt: now,
            updatedAt: now,
        }));

        await this.roleProfilesCollection.deleteMany({});
        await this.skillProfilesCollection.deleteMany({});
        await this.pathProfilesCollection.deleteMany({});
        await this.directionExamplesCollection.deleteMany({});

        if (roleProfiles.length > 0) {
            await this.roleProfilesCollection.insertMany(roleProfiles);
        }
        const skillProfiles = [...skillMap.values()];
        if (skillProfiles.length > 0) {
            await this.skillProfilesCollection.insertMany(skillProfiles);
        }
        if (directionExamples.length > 0) {
            await this.directionExamplesCollection.insertMany(directionExamples);
        }
    };
}
