import type { Conversation } from "../conversation/conversation.model";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import type { ConversationMemory } from "../memory/conversation-memory.types";

/** Profile-side dream direction shown to the future-planning reply model. */
export type FuturePlanningUserSnapshot = {
    readonly savedDreamJobLabel: string | null;
    readonly savedDreamJobConfidence: number | null;
};

/** Saved dream on user document for inference (may be empty). */
export type SavedDreamJobContext = {
    readonly dreamJob: string | null;
    readonly dreamJobConfidence: number | null;
};

const buildHistory = (conversation: Conversation): string =>
    conversation.messages
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join("\n");

const achievementsText = (conversation: Conversation): string =>
    conversation.achievements.length === 0
        ? "No achievements available yet."
        : conversation.achievements.map((achievement) => `- ${achievement.name}`).join("\n");

const memoryText = (memories: readonly ConversationMemory[]): string =>
    memories.length === 0
        ? "No memory snippets available."
        : memories.map((memory) => `- [${memory.type}] ${memory.text}`).join("\n");

const profileExplorationHints = (profile: UserCareerProfile): string => {
    const interests = profile.interests.slice(0, 8).map((item) => item.value);
    const workStyle = profile.workStyle.slice(0, 8).map((item) => item.value);
    const motivations = profile.motivations.slice(0, 6).map((item) => item.value);
    return [
        `Interests signals: ${interests.length > 0 ? interests.join(", ") : "none yet"}`,
        `Work style signals: ${workStyle.length > 0 ? workStyle.join(", ") : "none yet"}`,
        `Motivation signals: ${motivations.length > 0 ? motivations.join(", ") : "none yet"}`,
    ].join("\n");
};

const savedDreamJobReplySection = (user: FuturePlanningUserSnapshot): string => {
    const label = user.savedDreamJobLabel?.trim() ?? "";
    if (label.length === 0) {
        return `Saved long-term direction on profile: none yet.
First clarify whether they already picture a concrete future role or archetype, or are still comparing paths. Use natural wording; one question at a time.`;
    }
    const confText =
        user.savedDreamJobConfidence !== null && Number.isFinite(user.savedDreamJobConfidence)
            ? String(user.savedDreamJobConfidence)
            : "unknown";
    return `Saved long-term direction on profile: "${label}" (stored confidence ${confText}).
If their latest message reinforces this, acknowledge briefly and deepen with ONE future-oriented follow-up (path, environment, impact, responsibilities)—do not restart broad discovery.
If they refine or contradict it, explore the new direction with future-oriented questions only.`;
};

export const buildFuturePlanningReplyPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    memories: readonly ConversationMemory[],
    profile: UserCareerProfile,
    user: FuturePlanningUserSnapshot
): string => `
You are CareerCoach AI in long-term career planning mode.
The user is exploring where they want to go over time—not hunting for immediate job postings.

Hard rules:
- Do NOT recommend current job openings, listings, applications, interviews, or "roles to apply to now."
- Do NOT imply a database or company job search.
- Focus almost entirely on the FUTURE: target role archetype, path, environment (startup vs corporate vs founder), technical vs management, product vs platform vs architecture, leadership, impact, lifestyle, and future responsibilities they want.
- Ask exactly ONE conversational question per reply (unless they asked a direct factual question you may answer in one short sentence first, then still end with exactly one question).
- You may use one brief clause mirroring their background for rapport, but the question itself must be forward-looking—not about past jobs, past projects, retrospective enjoyment, or "what was meaningful about being X in the past."
- Forbidden question styles (do not use): what did you enjoy in past work, what aspects of your previous role, tell me about a past project, what felt meaningful about being [role] before, walk me through your history.
- Preferred themes when exploring: whether they already have a future role in mind; IC vs manager track; startup vs big company vs founding; product vs engineering leadership; domain of impact; pace and autonomy; scope of ownership they want next.
- Keep it lightweight: avoid deep coaching loops about mission, company values, startup philosophy, leadership ideology, or abstract "life vision" unless the user clearly invites that depth.
- If they already stated a concrete aspiration this turn or recently, prefer briefly acknowledging it and at most one narrow follow-up—or shift toward closure if they seem satisfied.

${savedDreamJobReplySection(user)}

Profile signals (context only—do not ask them to "tell me more about your past" from these; use only to personalize future-oriented questions):
${profileExplorationHints(profile)}

Relevant user memory snippets:
${memoryText(memories)}

User achievements (background only—do not interrogate the past from this list):
${achievementsText(conversation)}

Conversation so far:
${buildHistory(conversation)}

Latest user message:
${latestUserMessage}

Respond ONLY with valid JSON:
{ "reply": "string" }
`;

const savedDreamJobInferenceSection = (saved: SavedDreamJobContext): string => {
    const label = saved.dreamJob?.trim() ?? "";
    const hasLabel = label.length > 0;
    const conf =
        saved.dreamJobConfidence !== null && Number.isFinite(saved.dreamJobConfidence)
            ? String(saved.dreamJobConfidence)
            : "n/a";
    return `Already saved on user profile:
- dreamJob: ${hasLabel ? `"${label}"` : "none"}
- dreamJobConfidence: ${conf}

If the latest user messages clearly name or confirm a future target, set dreamJob to a concise label (2–4 words) and confidence 80+ when the statement is explicit (e.g. "I want to become a product manager", "I see myself as an architect").
If that matches the saved dreamJob and they are confirming, return the same dreamJob with confidence at least max(80, prior stored confidence if any).
If evidence is weak or only vague background, return dreamJob null and confidence under 40 (omit persisting downstream).
When the user pivots to a new explicit direction, prefer the new label with appropriately high confidence.
Do not infer a specific dreamJob from generic background alone (e.g. "software developer" with no stated future aim).`;
};

export const buildDreamJobInferencePrompt = (
    conversation: Conversation,
    profile: UserCareerProfile,
    saved: SavedDreamJobContext
): string => `
You infer a concise "dream job" LABEL (a role archetype the user wants to grow toward), plus confidence and reasoning, from a long-term planning coaching chat.
The label must NOT come from job postings; it is a collaborative future-facing title (e.g. "Platform Engineer", "Product Manager", "Technical Founder").
Weight the latest user messages highest. Combine the last few user turns when one clarifies another (e.g. "CEO" then "startup").

CRITICAL: If the latest user message ONLY expresses wanting long-term exploration, a timeline preference, or answering "future vs now" (for example: "long term direction", "figuring out my direction", "exploring careers") WITHOUT explicitly naming a target role they want to become, you MUST return dreamJob null and confidence below 30. Never invent a title (e.g. "Startup CEO") from vague exploration language alone.

Title normalization (fit the user's words; do not aggressively over-correct; prefer 2–4 words):
When the user uses explicit aspiration phrasing ("I want to be", "I like to be", "I want to manage", "I see myself as") with a recognizable target, confidence is usually 85–95 unless they add strong uncertainty ("maybe", "not sure", "could be anything").

Respond ONLY with valid JSON:
{
  "dreamJob": "string or null",
  "confidence": number,
  "reasoning": ["string"]
}

Rules:
- dreamJob: 2-4 words preferred when non-null; no company names; no "TBD".
- confidence: integer 0-100.
- reasoning: 2-6 short bullet strings explaining the inference.

${savedDreamJobInferenceSection(saved)}

User achievements:
${achievementsText(conversation)}

Profile signals (values only):
- interests: ${profile.interests.map((i) => i.value).join(", ") || "none"}
- workStyle: ${profile.workStyle.map((i) => i.value).join(", ") || "none"}
- motivations: ${profile.motivations.map((i) => i.value).join(", ") || "none"}
- longTermGoals: ${profile.longTermGoals.map((i) => i.value).join(", ") || "none"}

Conversation:
${buildHistory(conversation)}
`;

export type FuturePlanningClosingParams = {
    readonly normalizedDreamJob: string;
    readonly latestUserMessage: string;
    readonly profileHintLine: string;
    readonly persistedToProfile: boolean;
    /** True when saving to the user profile was attempted but failed (e.g. session expired). */
    readonly profileUpdateFailed: boolean;
    readonly priorSavedDreamJob: string | null;
};

export const buildFuturePlanningClosingPrompt = (p: FuturePlanningClosingParams): string => {
    const persistNote = p.persistedToProfile
        ? "The system just saved this normalized direction as their long-term dreamJob on their profile."
        : p.profileUpdateFailed
            ? `The system TRIED to save "${p.normalizedDreamJob}" to the user's profile but the update FAILED (for example expired session or server error). Nothing new was written to their saved profile.`
            : `The system did NOT overwrite the profile because an existing saved direction had higher confidence, or persistence was skipped before a network save. Prior saved label: "${p.priorSavedDreamJob ?? "none"}". Still treat "${p.normalizedDreamJob}" as what they expressed now—close supportively without interrogation.`;
    return `
You are CareerCoach AI. The user is in long-term future planning and has already stated a clear enough aspiration; exploration should stop here—no more discovery questions.

${persistNote}

Write a short, natural closing (2–4 sentences). Requirements:
- Use the normalized direction label exactly as given: "${p.normalizedDreamJob}".
- You may weave in one subtle nod to profile hints only if it fits naturally: ${p.profileHintLine}
- If the direction was saved: confirm warmly that it is saved and they can refine it later when they want.
- If the update failed: acknowledge their direction, be clear their profile was NOT updated, suggest refreshing the app or signing in again so it can save next time, and do NOT imply it is already stored.
- If not saved for other reasons (higher-confidence prior, etc.): acknowledge their direction and mention they can update their saved long-term goal anytime—no pressure.
- NEVER claim the profile was saved, stored, recorded, or "on file" unless the direction was actually saved (see persist note above).
- Do NOT ask about mission, values, startup philosophy, leadership ideology, organizational culture, or abstract purpose.
- Do NOT end with a required follow-up question; optional soft "we can adjust anytime" is fine.

Latest user message:
${p.latestUserMessage}

Respond ONLY with valid JSON:
{ "reply": "string" }
`;
};
