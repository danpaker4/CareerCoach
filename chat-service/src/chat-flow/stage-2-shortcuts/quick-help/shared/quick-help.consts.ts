export const QUICK_HELP_EXIT_REPLY =
    "Okay — we can leave that for now. What would you like to talk about next?";

export const QUICK_HELP_EXIT_PATTERNS: readonly RegExp[] = [
    /\b(stop|cancel|never\s*mind|nevermind)\b/i,
    /\b(talk|speak|chat)\s+about\s+(something|anything)\s+else\b/i,
    /\bdifferent\s+(topic|subject|question)\b/i,
    /\b(not\s+this|leave\s+this|exit|quit)\b/i,
    /\bchange\s+(the\s+)?(topic|subject)\b/i,
    /\bi\s+(want|need)\s+to\s+(talk|ask)\s+about\s+something\s+else\b/i,
];

export const QUICK_HELP_SKILLS_INTENT_PATTERNS: readonly RegExp[] = [
    /what skills should i learn/i,
    /skills?\s+(for|to)\s+(my\s+)?(next\s+)?role/i,
    /what\s+should\s+i\s+learn\s+for\s+(my\s+)?(next\s+)?role/i,
];

export const QUICK_HELP_JOB_MATCH_INTENT_PATTERNS: readonly RegExp[] = [
    /suggest jobs that match my profile/i,
    /jobs?\s+that\s+match\s+(my\s+)?profile/i,
    /find\s+jobs?\s+(for|matching)\s+me/i,
    /match(ed|ing)?\s+jobs?\s+to\s+(my\s+)?(skills?|profile)/i,
];

export const QUICK_HELP_CV_INTENT_PATTERNS: readonly RegExp[] = [
    /how can i improve my cv/i,
    /improve\s+(my\s+)?(cv|resume)/i,
    /review\s+(my\s+)?(cv|resume)/i,
    /(cv|resume)\s+feedback/i,
];

export const QUICK_HELP_INTERVIEW_INTENT_PATTERNS: readonly RegExp[] = [
    /help me prepare for interviews/i,
    /interview\s+prep/i,
    /prepare\s+for\s+(an\s+)?interview/i,
    /practice\s+interview/i,
];
