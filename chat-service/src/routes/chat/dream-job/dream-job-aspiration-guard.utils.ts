/**
 * True when the latest message only expresses timeline / exploration preference (e.g. answering
 * "immediate vs long-term") without naming a concrete future role. In that case dream-job
 * inference must not run (LLMs often hallucinate titles like "Startup CEO" from weak context).
 */
export const isCareerTimelinePreferenceWithoutRole = (message: string): boolean => {
    const normalized = message.toLowerCase().trim();
    if (normalized.length === 0) {
        return false;
    }

    const explicitAspiration =
        /\b(i want to be|i'd like to be|i want to become|i like to be|i see myself as|i want to manage|i want to lead|i want to run|going to be a|want to be a|want to be an)\b/i.test(
            normalized
        );

    if (explicitAspiration) {
        return false;
    }

    const timelineOrModeOnly =
        /\b(looking for|seeking|interested in|focused on|want)\s+(a\s+)?(my\s+)?(long[- ]term|longer[- ]term)\b.*\b(direction|path|planning|plan)\b/i.test(
            normalized
        )
        || /\b(long[- ]term|longer[- ]term)\b.*\b(direction|career path|path|planning)\b/i.test(normalized)
        || /\b(future)\b.*\b(direction|planning|path|career)\b/i.test(normalized)
        || /\b(figuring out|figure out)\b.*\b(direction|path|what i want|next step)\b/i.test(normalized)
        || /\b(exploring)\b.*\b(options|careers|directions?|paths?)\b/i.test(normalized)
        || /\b(not job hunting|not looking for a job|not searching now)\b/i.test(normalized);

    return timelineOrModeOnly;
};
