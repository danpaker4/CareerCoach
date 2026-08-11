import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import type { JobSearchResultItem } from "../../api/shared/chat.types";

/**
 * The structured skill fields carry the technologies a posting actually requires, which the prose
 * description often only implies. Scoring against the description alone under-rates relevant roles.
 */
export const buildRankingCorpus = (job: JobSearchResultItem): string =>
    [
        job.title,
        job.description,
        ...(job.requirements ?? []),
        ...(job.mustKnowSkills ?? []),
        ...(job.niceToHaveSkills ?? []),
    ]
        .join(" ")
        .toLowerCase();

/**
 * The match score is only meaningful once the profile carries something to match against.
 * For an empty profile every job scores at the same floor, so filtering on it would hide
 * every result from exactly the users who have seen the fewest.
 */
export const hasRankableProfile = (profile: UserCareerProfile): boolean =>
    profile.technologies.length > 0 || profile.interests.length > 0;
