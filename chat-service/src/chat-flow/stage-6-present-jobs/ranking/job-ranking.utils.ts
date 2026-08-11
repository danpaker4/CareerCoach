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

/** Words that carry no role meaning, so they must not count as a match against a posting. */
const ROLE_STOP_WORDS: ReadonlySet<string> = new Set([
    "job", "jobs", "role", "roles", "position", "positions", "opening", "openings", "vacancy",
    "vacancies", "work", "for", "the", "and", "any", "some", "with", "that", "please", "now",
    "looking", "want", "need", "find", "show", "get", "send", "list", "search", "engineer",
    "engineering", "developer", "specialist", "professional", "me", "my", "us", "we", "in", "at",
    "on", "of", "to", "as", "an", "is", "it",
]);

/**
 * The role words a search was actually about. "engineer" and "developer" are dropped because nearly
 * every posting contains them, so keeping them would score unrelated roles as matches.
 */
export const extractRoleTerms = (targetRole: string | undefined): string[] => {
    if (!targetRole) return [];
    return Array.from(
        new Set(
            targetRole
                .toLowerCase()
                .split(/[^a-z0-9+#.]+/)
                .filter((term) => term.length >= 2 && !ROLE_STOP_WORDS.has(term))
        )
    );
};

/**
 * How well a posting answers the role that was asked for. A term in the title is what a user reads
 * as "this is the job I asked for", so it counts for far more than the same term buried in the body.
 */
export const scoreRoleRelevance = (roleTerms: readonly string[], job: JobSearchResultItem): number => {
    if (roleTerms.length === 0) return 0;
    const title = job.title.toLowerCase();
    const corpus = buildRankingCorpus(job);
    const titleHits = roleTerms.filter((term) => title.includes(term)).length;
    const corpusHits = roleTerms.filter((term) => corpus.includes(term)).length;
    const titleShare = titleHits / roleTerms.length;
    const corpusShare = corpusHits / roleTerms.length;
    return Math.round(Math.min(100, (titleShare * 80) + (corpusShare * 20)));
};
