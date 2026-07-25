import type { ProfileInput } from "../../../routes/conversation/conversation.types";
import { MAX_CV_CONTEXT_CHARS } from "./user-account-context.consts";
import { readString } from "./profile-field.utils";

/** True when the value looks like a stored CV file reference, not resume text. */
export const isCvStorageReference = (value: string): boolean => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return false;
    }
    if (/^s3:\/\//i.test(trimmed)) {
        return true;
    }
    if (/^uploads\/cv\//i.test(trimmed)) {
        return true;
    }
    if (/^https?:\/\//i.test(trimmed) && /\/(?:cv|resumes?)\//i.test(trimmed)) {
        return true;
    }
    return false;
};

export const isReadableCvText = (value: string): boolean => {
    const trimmed = value.trim();
    return trimmed.length >= 40 && !isCvStorageReference(trimmed);
};

const truncateCvExcerpt = (value: string): string =>
    value.length > MAX_CV_CONTEXT_CHARS ? `${value.slice(0, MAX_CV_CONTEXT_CHARS)}…` : value;

/**
 * Prefer extracted CV plain text. Never treat an S3/path URI as resume content.
 */
export const pickCvExcerpt = (
    serverUser: Record<string, unknown>,
    profile?: ProfileInput | null
): string | null => {
    const fromServerText = readString(serverUser.cvText);
    if (fromServerText !== null && isReadableCvText(fromServerText)) {
        return truncateCvExcerpt(fromServerText);
    }

    const fromProfile = profile?.cvExcerpt?.trim() ?? "";
    if (isReadableCvText(fromProfile)) {
        return truncateCvExcerpt(fromProfile);
    }

    const fromServerCv = readString(serverUser.cv);
    if (fromServerCv !== null && isReadableCvText(fromServerCv)) {
        return truncateCvExcerpt(fromServerCv);
    }

    return null;
};
