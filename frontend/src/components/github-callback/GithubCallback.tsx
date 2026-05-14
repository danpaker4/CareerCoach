import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ENV } from '../../config';
import './GithubCallback.css';
import type { User } from '../../types/user';
import { setStoredAccessToken } from '../../lib/authSession';
import { normalizeUser } from '../../lib/authResponse';

interface GithubCallbackProps {
  onLoginSuccess: (user: User) => void;
}

type CallbackState = 'loading' | 'error';

export const GithubCallback = ({ onLoginSuccess }: GithubCallbackProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      setErrorMessage('No OAuth code received');
      setState('error');
      return;
    }

    if (window.opener) {
      window.opener.postMessage({ type: 'GITHUB_CODE', code }, window.location.origin);
      window.close();
      return;
    }

    fetch(
      `${ENV.USERS_SERVICE_BASE_URL}/api/auth/github/callback?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(window.location.origin + '/auth/github/callback')}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    )
      .then(async (res) => {
        if (!res.ok) {
          const body: unknown = await res.json().catch(() => null);
          const msg =
            typeof body === 'object' &&
            body !== null &&
            typeof (body as Record<string, unknown>).message === 'string'
              ? (body as Record<string, unknown>).message as string
              : `Authentication failed (${res.status})`;
          throw new Error(msg);
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
        navigate('/dashboard', { replace: true });
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
          <Link to="/login" className="btn-primary github-callback-back">
            Back to Login
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
        <p className="github-callback-message">Please wait while we log you in.</p>
      </div>
    </div>
  );
};
