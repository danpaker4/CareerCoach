import { buildDreamJobPrompt } from "../../src/routes/chat/dream-job/chat.dream-job.prompt.utils";
import { buildDecisionPrompt, buildModeDetectionPrompt, buildStagePrompt } from "../../src/routes/chat/llm/chat.prompt.utils";
import { EMPTY_ACHIEVEMENTS, FIXTURE_CONVERSATION, FIXTURE_STAGE, FIXTURE_USER_ACCOUNT_CONTEXT } from "../fixtures";

type PromptType = "decision" | "stage" | "mode-detection" | "dream-job";

type PromptfooPromptArgs = {
    readonly vars: {
        readonly promptType?: PromptType;
        readonly latestUserMessage?: string;
    };
};

export default ({ vars }: PromptfooPromptArgs): string => {
    const latestUserMessage = vars.latestUserMessage ?? "Tell me about frontend roles.";
    const promptType = vars.promptType ?? "decision";

    if (promptType === "stage") {
        return buildStagePrompt(
            FIXTURE_CONVERSATION,
            latestUserMessage,
            FIXTURE_STAGE,
            EMPTY_ACHIEVEMENTS,
            "GUIDED",
            FIXTURE_USER_ACCOUNT_CONTEXT
        );
    }

    if (promptType === "mode-detection") {
        return buildModeDetectionPrompt(
            FIXTURE_CONVERSATION,
            latestUserMessage,
            EMPTY_ACHIEVEMENTS,
            FIXTURE_USER_ACCOUNT_CONTEXT
        );
    }

    if (promptType === "dream-job") {
        return buildDreamJobPrompt({
            conversation: FIXTURE_CONVERSATION,
            latestUserMessage,
            userAccountContext: FIXTURE_USER_ACCOUNT_CONTEXT,
            dreamJobFlow: undefined,
        });
    }

    return buildDecisionPrompt(
        FIXTURE_CONVERSATION,
        latestUserMessage,
        EMPTY_ACHIEVEMENTS,
        FIXTURE_USER_ACCOUNT_CONTEXT
    );
};
