import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ENV } from '../../config';
import './GithubCallback.css';
import type { User } from '../../types/user';
import { setStoredAccessToken } from '../../lib/authSession';

interface GithubCallbackProps {
  onLoginSuccess: (user: User) => void;
}

type CallbackState = 'loading' | 'error';

const parseUser = (data: unknown): User | null => {
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.firstName !== 'string' ||
    typeof obj.lastName !== 'string' ||
    typeof obj.email !== 'string'
  ) return null;
  return {
    id: obj.id,
    firstName: obj.firstName,
    lastName: obj.lastName,
    email: obj.email,
    ...(typeof obj.currentJob === 'string' ? { currentJob: obj.currentJob } : {}),
    ...(typeof obj.birthDate === 'string' ? { birthDate: obj.birthDate } : {}),
    ...(typeof obj.linkedInUrl === 'string' ? { linkedInUrl: obj.linkedInUrl } : {}),
    ...(typeof obj.githubUrl === 'string' ? { githubUrl: obj.githubUrl } : {}),
    ...(typeof obj.cv === 'string' ? { cv: obj.cv } : {}),
    ...(Array.isArray(obj.achievements) ? { achievements: obj.achievements as User['achievements'] } : {}),
  };
};

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
        const data: any = await res.json();
        const user = parseUser(data.user || data);
        if (!user) throw new Error('Invalid user data received');

        if (data.accessToken) {
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
