import { ENV } from "../config";

type GithubOAuthMode = "login" | "profile";

const GITHUB_LOGIN_SCOPES = "read:user user:email";
const GITHUB_PROFILE_SCOPES = "read:user";
const GITHUB_PROFILE_STATE = "profile_connect";

export const getGithubOAuthUrl = (mode: GithubOAuthMode = "login"): string | null => {
  if (!ENV.GITHUB_CLIENT_ID) {
    return null;
  }

  const redirectUri = `${window.location.origin}/auth/github/callback`;
  const scopes = mode === "profile" ? GITHUB_PROFILE_SCOPES : GITHUB_LOGIN_SCOPES;
  const params = new URLSearchParams({
    client_id: ENV.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: scopes,
    prompt: "select_account",
  });

  if (mode === "profile") {
    params.set("state", GITHUB_PROFILE_STATE);
  }

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};

export const isGithubProfileConnectState = (state: string | null): boolean => state === GITHUB_PROFILE_STATE;

export const connectGithubAccount = (mode: GithubOAuthMode = "login"): boolean => {
  const url = getGithubOAuthUrl(mode);
  if (!url) {
    return false;
  }

  window.location.assign(url);
  return true;
};
