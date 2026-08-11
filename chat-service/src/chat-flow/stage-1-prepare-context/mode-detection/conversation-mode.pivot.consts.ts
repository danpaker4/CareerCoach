/** Phrases that mean the user wants long-term dream-job coaching, not current-role questions. */
export const DREAM_JOB_PIVOT_PATTERNS: readonly RegExp[] = [
    /\bprefer\b.{0,40}\bdream\s*jobs?\b/i,
    /\b(?:talk|speak|chat|focus|switch)\b.{0,40}\bdream\s*jobs?\b/i,
    /\bdream\s*jobs?\b.{0,40}\b(?:instead|please|now)\b/i,
    /\blet'?s\s+(?:talk|speak|chat|discuss)\b.{0,40}\bdream\s*jobs?\b/i,
    /\bi\s+(?:want|wanna)\s+to\s+(?:talk|speak|chat)\b.{0,40}\bdream\s*jobs?\b/i,
    /\babout\s+my\s+dream\s*jobs?\b/i,
    /\blong[-\s]?term\s+(?:goal|dream|career|plan|path)\b/i,
    /\b(?:thinking|planning|focused)\s+(?:about|on)\s+(?:the\s+)?future\b/i,
    /\b(?:for|in)\s+the\s+future\b/i,
    /\byears?\s+from\s+now\b/i,
    /\bfuture\s+(?:career|goals?|plans?|path|role)\b/i,
    /\bi\s+(?:want|wanna)\s+(?:a\s+)?(?:long[-\s]?term|future)\b/i,
];

/** Phrases that mean the user wants a near-term job search, not dream-job coaching. */
export const NEAR_TERM_PIVOT_PATTERNS: readonly RegExp[] = [
    /\blooking for (?:a )?(?:new )?(?:job|role|position)\b/i,
    /\b(?:searching|hunt(?:ing)?)\s+for\s+(?:a\s+)?(?:new\s+)?(?:job|role|position)\b/i,
    /\b(?:want|wanna|need)\s+(?:a\s+)?(?:new\s+)?(?:job|role|position)\s+(?:now|soon|asap)?\b/i,
    /\b(?:want|wanna|need)\s+to\s+change\s+jobs?\b/i,
    /\bchange\s+jobs?\s+(?:now|soon|asap)\b/i,
    /\b(?:job|role|position)\s+(?:now|asap|right now|immediately)\b/i,
    /\bfind\s+(?:me\s+)?(?:a\s+)?(?:job|role|position)s?\b/i,
    /\bshow\s+me\s+(?:a\s+)?(?:job|role|position)s?\b/i,
    /\bskip\s+to\s+(?:the\s+)?jobs?\b/i,
    /\bopen to (?:new )?(?:jobs?|roles?|opportunities)\b/i,
    /\b(?:next|new)\s+(?:job|role|position)\s+(?:now|soon|asap)?\b/i,
    /\bnext\s+(?:\d{1,2}\s+|few\s+)?months?\b/i,
    /\bhiring\s+now\b/i,
    /\b(?:something|a job|a role|a position)\s+(?:for\s+)?now\b/i,
];

/** Phrases that mean the user is undecided — stay in GUIDED discovery (no N/D override). */
export const UNDECIDED_DIRECTION_PATTERNS: readonly RegExp[] = [
    /\bi\s+don'?t\s+know\b/i,
    /\bi\s+do\s+not\s+know\b/i,
    /\bnot\s+sure\b/i,
    /\bno\s+idea\b/i,
    /\bunsure\b/i,
    /\bfiguring\s+(?:it\s+)?out\b/i,
    /\bstill\s+exploring\b/i,
    /\bi'?m\s+not\s+sure\b/i,
    /\bhaven'?t\s+decided\b/i,
];
