import type { ProfileInput } from "../../../../routes/conversation/conversation.types";
import { isReadableCvText } from "../../../stage-1-prepare-context/user-context/cv-context.utils";

export const hasUsableCvContext = (params: {
    profile: ProfileInput | undefined;
    userAccountContext: string;
}): boolean => {
    const excerpt = params.profile?.cvExcerpt?.trim() ?? "";
    if (isReadableCvText(excerpt)) {
        return true;
    }
    const contextMatch = params.userAccountContext.match(/CV excerpt \(truncated\):\s*([\s\S]+)$/i);
    const fromContext = contextMatch?.[1]?.trim() ?? "";
    return isReadableCvText(fromContext);
};

export const isAffirmativeReadyMessage = (message: string): boolean => {
    const normalized = message.trim().toLowerCase();
    return (
        normalized === "ready" ||
        normalized === "done" ||
        normalized === "uploaded" ||
        normalized === "i uploaded" ||
        normalized === "continue" ||
        normalized === "go ahead" ||
        /\b(i\s+)?(have\s+)?uploaded\b/i.test(message) ||
        /\bready\b/i.test(message)
    );
};
