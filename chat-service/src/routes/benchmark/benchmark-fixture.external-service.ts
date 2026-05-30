import type { JobSearchPlanRequest, JobSearchRequest, JobSearchResultItem, UserAchievementResponse } from "../chat/chat.types";
import { ChatExternalService } from "../external-chat/chat.external.service";
import type { ApplyInferredAchievementSignalsParams, ApplyInferredRoleExperienceParams } from "../external-chat/chat.external.types";
import type { RoleExperienceEntry } from "../external-chat/role-experience.types";
import type { BenchmarkCase } from "./benchmark.types";

export class BenchmarkFixtureExternalService extends ChatExternalService {
    constructor(private readonly benchmarkCase: BenchmarkCase) {
        super("", "");
    }

    override readUserAchievements = async (): Promise<UserAchievementResponse[]> =>
        this.benchmarkCase.achievements.map((achievement) => ({ ...achievement }));

    override searchJobs = async (_filters: JobSearchRequest): Promise<JobSearchResultItem[]> =>
        this.benchmarkCase.jobs.map((job) => ({ ...job }));

    override searchJobsByPlan = async (_plan: JobSearchPlanRequest): Promise<JobSearchResultItem[]> =>
        this.benchmarkCase.jobs.map((job) => ({ ...job }));

    override upsertAchievementFromUserMessage = async (): Promise<UserAchievementResponse[] | null> => null;

    override readUserRoleExperience = async (): Promise<RoleExperienceEntry[]> =>
        this.benchmarkCase.roleExperience.map((entry) => ({ ...entry, evidence: [...entry.evidence] }));

    override readUserPublicProfile = async (): Promise<Record<string, unknown> | null> => ({
        firstName: this.benchmarkCase.profile.firstName ?? "Benchmark",
        lastName: this.benchmarkCase.profile.lastName ?? "User",
        currentJob: this.benchmarkCase.profile.currentJob ?? "",
        technologies: [...(this.benchmarkCase.profile.technologies ?? [])],
        interests: [...(this.benchmarkCase.profile.interests ?? [])],
        githubSkills: [...(this.benchmarkCase.profile.githubSkills ?? [])],
        knownSkills: [...(this.benchmarkCase.profile.knownSkills ?? [])],
        cvExcerpt: this.benchmarkCase.profile.cvExcerpt ?? "",
        achievements: this.benchmarkCase.achievements.map((achievement) => ({ ...achievement })),
        roleExperience: this.benchmarkCase.roleExperience.map((entry) => ({ ...entry, evidence: [...entry.evidence] })),
    });

    override notifyCoachProfileMaterialized = async (): Promise<void> => undefined;

    override applyInferredAchievementSignals = async (_userId: string, _params: ApplyInferredAchievementSignalsParams): Promise<void> =>
        undefined;

    override applyInferredRoleExperience = async (_userId: string, _params: ApplyInferredRoleExperienceParams): Promise<void> =>
        undefined;
}
