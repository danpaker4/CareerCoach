import type { Collection } from "mongodb";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type {
    CareerDirectionExample,
    CareerPathProfile,
    CareerPathQueryResponse,
    CareerRoleProfile,
    CareerSkillProfile,
    MarketRequirementsResponse,
} from "./career-knowledge.types";
import { aggregateMarketRequirements } from "./market-requirements.extractor";
import {
    extractSeniorityToken,
    inferRoleFamily,
    mergeStringLists,
    normalizeRoleCategory,
    seniorityRank,
    toCounterObject,
} from "./career-knowledge.utils";

type RoleAggregate = {
    roleCategory: string;
    roleFamily: string;
    seniorityToken: string;
    jobs: EnrichedJob[];
};

const buildRoleAggregates = (jobs: EnrichedJob[]): RoleAggregate[] => {
    const map = new Map<string, RoleAggregate>();
    for (const job of jobs) {
        const roleCategory = normalizeRoleCategory(job.jobTitle, job.seniority ?? "");
        const seniorityToken = extractSeniorityToken(job.jobTitle, job.seniority ?? "");
        const roleFamily = inferRoleFamily(roleCategory);
        const existing = map.get(roleCategory);
        if (existing) {
            existing.jobs.push(job);
            continue;
        }
        map.set(roleCategory, { roleCategory, roleFamily, seniorityToken, jobs: [job] });
    }
    return [...map.values()];
};

const buildPathProfiles = (aggregates: readonly RoleAggregate[], now: Date): CareerPathProfile[] => {
    const byFamily = aggregates.reduce<Map<string, RoleAggregate[]>>((acc, aggregate) => {
        const list = acc.get(aggregate.roleFamily) ?? [];
        list.push(aggregate);
        acc.set(aggregate.roleFamily, list);
        return acc;
    }, new Map());

    const paths: CareerPathProfile[] = [];
    for (const familyAggregates of byFamily.values()) {
        const sorted = [...familyAggregates].sort(
            (a, b) => seniorityRank(a.seniorityToken) - seniorityRank(b.seniorityToken)
        );
        for (let i = 0; i < sorted.length - 1; i += 1) {
            const from = sorted[i];
            const to = sorted[i + 1];
            const fromSkills = mergeStringLists(
                from.jobs.map((j) => [...(j.mustKnowSkills ?? []), ...(j.requirements ?? [])])
            );
            const toSkills = mergeStringLists(
                to.jobs.map((j) => [...(j.mustKnowSkills ?? []), ...(j.requirements ?? [])])
            );
            const overlap = toSkills.filter((skill) =>
                fromSkills.some((f) => f.toLowerCase() === skill.toLowerCase())
            );
            const overlapScore = toSkills.length === 0 ? 0 : overlap.length / toSkills.length;
            paths.push({
                fromRole: from.roleCategory,
                toRole: to.roleCategory,
                requiredSkills: toSkills.slice(0, 20),
                overlapScore: Math.round(overlapScore * 100) / 100,
                evidenceJobIds: [...from.jobs, ...to.jobs].map((j) => j.id).slice(0, 10),
                embedding: to.jobs[0]?.searchEmbedding ?? [],
                createdAt: now,
                updatedAt: now,
            });
        }
    }
    return paths;
};

export class CareerKnowledgeService {
    constructor(
        private readonly jobsCollection: Collection<EnrichedJob>,
        private readonly roleProfilesCollection: Collection<CareerRoleProfile>,
        private readonly skillProfilesCollection: Collection<CareerSkillProfile>,
        private readonly pathProfilesCollection: Collection<CareerPathProfile>,
        private readonly directionExamplesCollection: Collection<CareerDirectionExample>
    ) {}

    refreshKnowledge = async (): Promise<{ roleCount: number; pathCount: number; skillCount: number }> => {
        const jobs = await this.jobsCollection
            .find(
                {},
                {
                    projection: {
                        id: 1,
                        jobTitle: 1,
                        seniority: 1,
                        requirements: 1,
                        mustKnowSkills: 1,
                        niceToHaveSkills: 1,
                        description: 1,
                        languages: 1,
                        frameworks: 1,
                        databases: 1,
                        platforms: 1,
                        tools: 1,
                        searchEmbedding: 1,
                    },
                }
            )
            .toArray();
        const now = new Date();
        const aggregates = buildRoleAggregates(jobs);

        const roleProfiles: CareerRoleProfile[] = aggregates.map((aggregate) => {
            const market = aggregateMarketRequirements(
                aggregate.roleCategory,
                aggregate.jobs.map((j) => ({
                    seniority: j.seniority ?? "",
                    requirements: j.requirements ?? [],
                    mustKnowSkills: j.mustKnowSkills ?? [],
                    niceToHaveSkills: j.niceToHaveSkills ?? [],
                    description: j.description ?? "",
                    platforms: j.platforms ?? [],
                    tools: j.tools ?? [],
                }))
            );
            const sameFamilyRoles = aggregates
                .filter((a) => a.roleFamily === aggregate.roleFamily && a.roleCategory !== aggregate.roleCategory)
                .map((a) => a.roleCategory)
                .slice(0, 8);
            return {
                roleCategory: aggregate.roleCategory,
                roleName: aggregate.roleCategory,
                commonSkills: market.commonSkills,
                relatedRoles: sameFamilyRoles,
                commonDomains: [aggregate.roleFamily],
                responsibilities: market.responsibilities,
                leadershipSignals: market.leadershipSignals,
                architectureSignals: market.architectureSignals,
                seniorityDistribution: market.seniorityDistribution,
                sourceJobIds: aggregate.jobs.map((j) => j.id),
                embedding: aggregate.jobs[0]?.searchEmbedding ?? [],
                createdAt: now,
                updatedAt: now,
            };
        });

        const skillMap = new Map<string, CareerSkillProfile>();
        for (const job of jobs) {
            const roleCategory = normalizeRoleCategory(job.jobTitle, job.seniority ?? "");
            const skills = mergeStringLists([
                job.mustKnowSkills ?? [],
                job.requirements ?? [],
                job.languages ?? [],
                job.frameworks ?? [],
                job.databases ?? [],
                job.platforms ?? [],
                job.tools ?? [],
            ]);
            for (const skill of skills) {
                const existing = skillMap.get(skill);
                if (!existing) {
                    skillMap.set(skill, {
                        skillName: skill,
                        relatedRoles: [roleCategory],
                        relatedSkills: skills.filter((value) => value !== skill).slice(0, 20),
                        demandScore: 1,
                        sourceJobIds: [job.id],
                        embedding: job.searchEmbedding ?? [],
                        createdAt: now,
                        updatedAt: now,
                    });
                    continue;
                }
                existing.relatedRoles = [...new Set([...existing.relatedRoles, roleCategory])];
                existing.relatedSkills = mergeStringLists([existing.relatedSkills, skills.filter((v) => v !== skill)]).slice(0, 20);
                existing.demandScore += 1;
                existing.sourceJobIds = [...new Set([...existing.sourceJobIds, job.id])];
                existing.updatedAt = now;
            }
        }

        const pathProfiles = buildPathProfiles(aggregates, now);

        const directionExamples: CareerDirectionExample[] = roleProfiles.slice(0, 300).map((role) => ({
            directionName: role.roleCategory,
            description: `Career direction for ${role.roleCategory} based on ${role.sourceJobIds.length} real job postings.`,
            exampleRoles: [role.roleCategory, ...role.relatedRoles].slice(0, 5),
            exampleTasks: role.responsibilities.slice(0, 8),
            relatedSkills: role.commonSkills.slice(0, 12),
            embedding: role.embedding,
            sourceJobIds: role.sourceJobIds,
            createdAt: now,
            updatedAt: now,
        }));

        await this.roleProfilesCollection.deleteMany({});
        await this.skillProfilesCollection.deleteMany({});
        await this.pathProfilesCollection.deleteMany({});
        await this.directionExamplesCollection.deleteMany({});

        if (roleProfiles.length > 0) await this.roleProfilesCollection.insertMany(roleProfiles);
        const skillProfiles = [...skillMap.values()];
        if (skillProfiles.length > 0) await this.skillProfilesCollection.insertMany(skillProfiles);
        if (pathProfiles.length > 0) await this.pathProfilesCollection.insertMany(pathProfiles);
        if (directionExamples.length > 0) await this.directionExamplesCollection.insertMany(directionExamples);

        return { roleCount: roleProfiles.length, pathCount: pathProfiles.length, skillCount: skillProfiles.length };
    };

    getRoleProfile = async (roleCategory: string): Promise<CareerRoleProfile | null> => {
        const decoded = decodeURIComponent(roleCategory);
        return this.roleProfilesCollection.findOne({
            $or: [{ roleCategory: decoded }, { roleName: decoded }],
        });
    };

    getMarketRequirements = async (roleCategory: string): Promise<MarketRequirementsResponse | null> => {
        const profile = await this.getRoleProfile(roleCategory);
        if (profile) {
            return {
                roleCategory: profile.roleCategory,
                commonSkills: profile.commonSkills,
                responsibilities: profile.responsibilities,
                leadershipSignals: profile.leadershipSignals,
                architectureSignals: profile.architectureSignals,
                seniorityDistribution: profile.seniorityDistribution,
                sampleJobCount: profile.sourceJobIds.length,
            };
        }

        const jobs = await this.jobsCollection
            .find(
                { jobTitle: { $regex: decodeURIComponent(roleCategory).split(" ").slice(-2).join("|"), $options: "i" } },
                { limit: 20 }
            )
            .toArray();
        if (jobs.length === 0) return null;
        return aggregateMarketRequirements(
            decodeURIComponent(roleCategory),
            jobs.map((j) => ({
                seniority: j.seniority ?? "",
                requirements: j.requirements ?? [],
                mustKnowSkills: j.mustKnowSkills ?? [],
                niceToHaveSkills: j.niceToHaveSkills ?? [],
                description: j.description ?? "",
                platforms: j.platforms ?? [],
                tools: j.tools ?? [],
            }))
        );
    };

    getPathsBetweenRoles = async (fromRole: string, toRole: string): Promise<CareerPathQueryResponse> => {
        const decodedFrom = decodeURIComponent(fromRole);
        const decodedTo = decodeURIComponent(toRole);
        const directPaths = await this.pathProfilesCollection
            .find({ fromRole: decodedFrom, toRole: decodedTo })
            .limit(10)
            .toArray();

        if (directPaths.length > 0) {
            return { fromRole: decodedFrom, toRole: decodedTo, paths: directPaths };
        }

        const allPaths = await this.pathProfilesCollection.find({}).toArray();
        const fromFamily = inferRoleFamily(decodedFrom);
        const toFamily = inferRoleFamily(decodedTo);
        const relevant = allPaths.filter((path) => {
            const pathFromFamily = inferRoleFamily(path.fromRole);
            const pathToFamily = inferRoleFamily(path.toRole);
            return pathFromFamily === fromFamily || pathToFamily === toFamily || path.toRole === decodedTo;
        });

        return { fromRole: decodedFrom, toRole: decodedTo, paths: relevant.slice(0, 15) };
    };
}
