import type { JobSearchRequest, JobSearchResultItem } from "./job-search.utils";
import { isJobSearchResultItem, normalizeFilters, normalizeJobSearchResultItem } from "./job-search.utils";

export class RoadmapExternalService {
    constructor(
        private readonly usersServiceBaseUrl: string,
        private readonly jobServiceBaseUrl: string
    ) {}

    readUserPublicProfile = async (userId: string): Promise<Record<string, unknown> | null> => {
        const response = await fetch(`${this.usersServiceBaseUrl}/users/${userId}`);
        if (!response.ok) {
            return null;
        }
        const payload: unknown = await response.json().catch(() => null);
        if (typeof payload !== "object" || payload === null) {
            return null;
        }
        const record = { ...(payload as Record<string, unknown>) };
        delete record.password;
        return record;
    };

    searchJobs = async (filters: JobSearchRequest): Promise<JobSearchResultItem[]> => {
        const response = await fetch(`${this.jobServiceBaseUrl}/jobs/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(normalizeFilters(filters)),
        });

        if (!response.ok) {
            return [];
        }

        const payload: unknown = await response.json().catch(() => []);
        return Array.isArray(payload)
            ? payload
                .filter(isJobSearchResultItem)
                .map(normalizeJobSearchResultItem)
                .slice(0, 10)
            : [];
    };
}
