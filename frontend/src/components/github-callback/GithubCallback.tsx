import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ENV } from '../../config';
import './GithubCallback.css';
import type { User } from '../../types/user';
import { setStoredAccessToken } from '../../lib/authSession';
import { normalizeUser } from '../../lib/authResponse';
import { apiFetch } from '../../lib/apiClient';
import { isGithubProfileConnectState } from '../../lib/githubAuth';

interface GithubCallbackProps {
  onLoginSuccess: (user: User) => void;
}

type CallbackState = 'loading' | 'error';

const getErrorMessage = async (response: Response): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body === 'object' && body !== null) {
    const payload = body as Record<string, unknown>;
    if (typeof payload.error === 'string') {
      return payload.error;
    }
    if (typeof payload.message === 'string') {
      return payload.message;
    }
  }

  return `GitHub connection failed (${response.status})`;
};

export const GithubCallback = ({ onLoginSuccess }: GithubCallbackProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const stateParam = searchParams.get('state');
  const isProfileConnect = isGithubProfileConnectState(stateParam);

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      setErrorMessage('No OAuth code received');
      setState('error');
      return;
    }

    if (window.opener) {
      window.opener.postMessage({ type: 'GITHUB_CODE', code, state: stateParam }, window.location.origin);
      window.close();
      return;
    }

    const endpoint = isProfileConnect ? '/api/auth/github/link' : '/api/auth/github/callback';
    const requestUrl =
      `${ENV.USERS_SERVICE_BASE_URL}${endpoint}?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(window.location.origin + '/auth/github/callback')}`;
    const request = isProfileConnect
      ? apiFetch(requestUrl, { method: 'GET' })
      : fetch(requestUrl, { method: 'GET', credentials: 'include' });

    request
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await getErrorMessage(res));
        }
        const data: unknown = await res.json();
        const user = normalizeUser(
          typeof data === 'object' && data !== null && 'user' in data ? data.user : data
        );
        if (!user) throw new Error('Invalid user data received');

        if (typeof data === 'object' && data !== null && 'accessToken' in data && typeof data.accessToken === 'string') {
          setStoredAccessToken(data.accessToken);
        }

        onLoginSuccess(user);
        navigate(isProfileConnect ? '/profile' : '/dashboard', { replace: true });
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
        setState('error');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'error') {
    return (
      <div className="github-callback-page">
        <div className="github-callback-card">
          <div className="github-callback-icon github-callback-icon--error">
            <span aria-hidden="true">!</span>
          </div>
          <h2 className="github-callback-title">GitHub Login Failed</h2>
          <p className="github-callback-message">{errorMessage}</p>
          <Link to={isProfileConnect ? '/profile' : '/login'} className="btn-primary github-callback-back">
            {isProfileConnect ? 'Back to Profile' : 'Back to Login'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="github-callback-page">
      <div className="github-callback-card">
        <div className="spinner github-callback-spinner" />
        <h2 className="github-callback-title">Connecting your GitHub account...</h2>
        <p className="github-callback-message">
          {isProfileConnect ? 'Please wait while we extract your GitHub skills.' : 'Please wait while we log you in.'}
        </p>
      </div>
    </div>
  );
};
