import { parseJsonObjectFromLlm } from "../../shared/llm/json-response.utils";

const EXPLICIT_CONVERSATION_END_PATTERN =
    /^(?:(?:great|okay|ok|perfect|thanks|thank you)\s+)*(?:thats all|that is all|im done|i am done|all done|goodbye|bye)$/;

export const CONVERSATION_END_REPLY =
    "You're all set for now. I'm available whenever you want help with your job search, pipeline, interviews, or career plans.";

export const buildConversationEndPrompt = (latestAssistantMessage: string, latestUserMessage: string): string => `You classify whether a career-coaching user wants to end the current interaction.
Return ONLY compact JSON:
{"shouldEndConversation":true|false}

Use the meaning and conversational context, not exact phrases or keyword matching.
- true: the user politely declines, says they are done, or closes the conversation. This includes declining to choose or add one of the jobs the assistant just offered.
- false: the user rejects a job, asks for another result, corrects something, asks a follow-up, or still wants an action.
- If uncertain, return false.

Latest assistant message: ${latestAssistantMessage}
Latest user message: ${latestUserMessage}`;

export const parseConversationEndDecision = (rawText: string): boolean => {
    const parsed = parseJsonObjectFromLlm(rawText);
    return parsed?.shouldEndConversation === true;
};

export const isExplicitConversationEndMessage = (message: string): boolean => {
    const normalizedMessage = message
        .trim()
        .toLowerCase()
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return EXPLICIT_CONVERSATION_END_PATTERN.test(normalizedMessage);
};
