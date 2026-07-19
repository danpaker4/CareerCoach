import type { ProfileInput } from "../../../routes/conversation/conversation.types";
import { MAX_CV_CONTEXT_CHARS } from "./user-account-context.consts";
import { readString } from "./profile-field.utils";

export const pickCvExcerpt = (
    serverUser: Record<string, unknown>,
    profile?: ProfileInput | null
): string | null => {
    const fromProfile = profile?.cvExcerpt?.trim() ?? "";
    if (fromProfile.length > 0) {
        return fromProfile.length > MAX_CV_CONTEXT_CHARS
            ? `${fromProfile.slice(0, MAX_CV_CONTEXT_CHARS)}…`
            : fromProfile;
    }
    const fromServer = readString(serverUser.cv);
    if (fromServer === null) {
        return null;
    }
    return fromServer.length > MAX_CV_CONTEXT_CHARS
        ? `${fromServer.slice(0, MAX_CV_CONTEXT_CHARS)}…`
        : fromServer;
};
