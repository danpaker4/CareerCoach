export const OFF_TOPIC_REDIRECT_REPLY =
    "I can help with career planning, job searches, CVs, interviews, and skills. What career question would you like to work on?";

export const CAREER_CONTEXT_PATTERN =
    /\b(career|job|work|workplace|office|manager|coworker|interview|resume|cv|skill|role|employer|employee|promotion|salary)\b/i;

export const CLEAR_OFF_TOPIC_PATTERNS: readonly RegExp[] = [
    /\b(poop|pooping|pee|peeing|toilet|fart|defecat(?:e|ing|ion))\b/i,
    /\b(weather|sports score|recipe|cook(?:ing)? instructions)\b/i,
    /\bwhat is the capital of\b/i,
];

export const PROMPT_OVERRIDE_PATTERNS: readonly RegExp[] = [
    /\bignore (?:all |the )?(?:previous|prior|system) instructions?\b/i,
    /\b(?:rule|instruction)\s*\d+\s*:/i,
    /\b(?:must comply|never answer|reveal (?:the )?system prompt)\b/i,
];
