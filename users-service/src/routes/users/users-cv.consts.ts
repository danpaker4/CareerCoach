/** Cap stored CV plain text to keep Mongo documents bounded. */
export const MAX_STORED_CV_TEXT_CHARS = 100_000;

export const truncateCvTextForStorage = (cvText: string): string => {
    const trimmed = cvText.trim();
    if (trimmed.length <= MAX_STORED_CV_TEXT_CHARS) {
        return trimmed;
    }
    return `${trimmed.slice(0, MAX_STORED_CV_TEXT_CHARS)}…`;
};
