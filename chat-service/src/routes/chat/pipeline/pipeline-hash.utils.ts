/** Matches `hashStringToNumber` in `frontend/src/components/job-suggestions/JobSuggestions.tsx`. */
export const hashStringToNumber = (str: string): number =>
    Array.from({ length: str.length }, (_, index) => str.charCodeAt(index)).reduce(
        (hash, code) => ((hash * 31 + code) >>> 0),
        0
    );
