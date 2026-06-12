export type DreamJobLlmDecision = {
    reply: string;
    proposedDreamJobTitle?: string;
    awaitingConfirmation: boolean;
    userConfirmed: boolean;
};
