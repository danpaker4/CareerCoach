export const MAX_PRESENTED_JOBS = 5;

export const MAX_RANKED_POOL = 15;

/**
 * A job with no overlap against the profile still scores around 13, because growth potential and
 * location contribute a fixed floor. Requiring 20 means at least one real skill or interest hit.
 */
export const MIN_PRESENTED_MATCH_SCORE = 20;

export const EXHAUSTED_JOBS_REPLY =
    "Every match in the current list was already skipped or saved. Tell me a nearby title, skill, or domain to lean into and I will run a broader search.";

export const NO_JOBS_REPLY =
    "I looked for matches based on what we discussed, but couldn't find open roles right now. Could you share a different title or skill area to lean into?";

export const WEAK_MATCH_REPLY =
    "I found open roles, but none of them are a strong match for your profile yet. Tell me a different title or skill area to search, or I can save the role to your wishlist and alert you when a closer match is posted.";
