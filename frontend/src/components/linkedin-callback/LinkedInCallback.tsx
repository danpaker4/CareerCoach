import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ENV } from '../../config';
import './LinkedInCallback.css';
import type { User } from '../../types/user';
import { setStoredAccessToken } from '../../lib/authSession';
import { normalizeUser } from '../../lib/authResponse';

interface LinkedInCallbackProps {
  onLoginSuccess: (user: User) => void;
}

type CallbackState = 'loading' | 'error';

export const LinkedInCallback = ({ onLoginSuccess }: LinkedInCallbackProps) => {
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
      window.opener.postMessage({ type: 'LINKEDIN_CODE', code }, window.location.origin);
      window.close();
      return;
    }

    const redirectUri = `${window.location.origin}/auth/linkedin/callback`;
    fetch(
      `${ENV.USERS_SERVICE_BASE_URL}/api/auth/linkedin/callback?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(redirectUri)}`,
      { method: 'GET', credentials: 'include' }
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
        const data = await res.json() as Record<string, unknown>;
        const user = normalizeUser(data.user ?? data);
        if (!user) throw new Error('Invalid user data received');
        if (typeof data.accessToken === 'string') {
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
      <div className="linkedin-callback-page">
        <div className="linkedin-callback-card">
          <div className="linkedin-callback-icon linkedin-callback-icon--error">
            <span aria-hidden="true">!</span>
          </div>
          <h2 className="linkedin-callback-title">LinkedIn Login Failed</h2>
          <p className="linkedin-callback-message">{errorMessage}</p>
          <Link to="/login" className="btn-primary linkedin-callback-back">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="linkedin-callback-page">
      <div className="linkedin-callback-card">
        <div className="spinner linkedin-callback-spinner" />
        <h2 className="linkedin-callback-title">Connecting your LinkedIn account...</h2>
        <p className="linkedin-callback-message">Please wait while we log you in.</p>
      </div>
    </div>
  );
};
