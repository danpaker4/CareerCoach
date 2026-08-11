export const JOB_ID_LEAK_REGEX = /\bjobId\s*[:#-]?\s*[A-Za-z0-9-]+\b/gi;

/** A bare identifier the model copied out of the job payload. These never belong in a reply. */
export const BARE_UUID_REGEX =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export const STRIP_LINE_REGEX = /^\s*[-*]?\s*(salary|requirements?)\b.*$/gim;

/**
 * A runaway answer is worse than a short one: the chat window shows a wall of text and the useful
 * sentence scrolls away. Ordinary replies run to a handful of lines, so this only trims the ones
 * where the model ignored the instruction to stay brief.
 */
export const MAX_REPLY_LINES = 10;
