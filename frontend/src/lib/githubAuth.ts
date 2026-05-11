import { ENV } from "../config";

const GITHUB_SCOPES = "read:user user:email";

export const getGithubOAuthUrl = (): string | null => {
  if (!ENV.GITHUB_CLIENT_ID) {
    return null;
  }

  const redirectUri = `${window.location.origin}/auth/github/callback`;
  return `https://github.com/login/oauth/authorize?client_id=${ENV.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(GITHUB_SCOPES)}&prompt=select_account`;
};

export const connectGithubAccount = (): boolean => {
  const url = getGithubOAuthUrl();
  if (!url) {
    return false;
  }

  window.location.assign(url);
  return true;
};
