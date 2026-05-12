const tokenStore: { current: string | null } = { current: null };

const ACCESS_TOKEN_SESSION_KEY = "career_coach_access_token";

const readSessionAccessToken = (): string | null => {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const raw = window.sessionStorage.getItem(ACCESS_TOKEN_SESSION_KEY);
        return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
    } catch {
        return null;
    }
};

/** Returns the JWT used for `Authorization: Bearer` on API calls (users-service, chat forwarding, etc.). */
export const getStoredAccessToken = (): string | null => {
    if (typeof tokenStore.current === "string" && tokenStore.current.trim().length > 0) {
        return tokenStore.current.trim();
    }
    const fromSession = readSessionAccessToken();
    if (fromSession !== null) {
        tokenStore.current = fromSession;
    }
    return fromSession;
};

export const setStoredAccessToken = (token: string): void => {
    const trimmed = token.trim();
    tokenStore.current = trimmed.length > 0 ? trimmed : null;
    if (typeof window === "undefined") {
        return;
    }
    try {
        if (tokenStore.current !== null) {
            window.sessionStorage.setItem(ACCESS_TOKEN_SESSION_KEY, tokenStore.current);
        } else {
            window.sessionStorage.removeItem(ACCESS_TOKEN_SESSION_KEY);
        }
    } catch {
        /* sessionStorage may be unavailable (private mode, SSR) */
    }
};

export const clearStoredAccessToken = (): void => {
    tokenStore.current = null;
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.sessionStorage.removeItem(ACCESS_TOKEN_SESSION_KEY);
    } catch {
        /* ignore */
    }
};
