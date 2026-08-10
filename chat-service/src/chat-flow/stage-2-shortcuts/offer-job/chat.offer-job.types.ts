export type JobOfferDraft = {
    jobTitle: string;
    company: string;
    /** Experience level — one of intern, junior, mid, senior, staff, principal, manager. */
    seniority: string;
    location: string;
    requirements: string[];
    description: string;
    salary?: number;
    url?: string;
};
