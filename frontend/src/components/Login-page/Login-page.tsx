import { useState, useEffect, useRef } from 'react'
import { ENV } from '../../config'
import { Login, type LoginType } from '../../types/login'
import './Login-page.css'
import { SignIn } from './signIn-component/SignIn'
import { SignUp } from './signUp-component/SignUp'
import { Card } from './Login-Card/Card'
import { ButtonToggle } from './Login-Card/ButtonToggle'
import type { User } from '../../types/user'
import githubIcon from '../../assets/github-icon.svg'
import linkedInIcon from '../../assets/icon-linkedin.svg'
import { setStoredAccessToken } from '../../lib/authSession'
import { useNavigate } from 'react-router-dom'

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID as string | undefined;

export const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const [activeButton, setActiveButton] = useState<LoginType>(Login.signIn)
  const navigate = useNavigate();
  const [isLoadingGithub, setIsLoadingGithub] = useState(false);
  const [isLoadingLinkedIn, setIsLoadingLinkedIn] = useState(false);

  const handleButtonClick = (button: LoginType) => setActiveButton(button)

  const openPopup = (url: string, name: string) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    window.open(url, name, `width=${width},height=${height},left=${left},top=${top}`);
  };

  const loginWithGithub = () => {
    openPopup(
      `https://github.com/login/oauth/authorize?client_id=${ENV.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/github/callback')}&scope=read:user%20user:email&prompt=select_account`,
      'github-oauth'
    );
  };

  const loginWithLinkedIn = () => {
    openPopup(
      `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/linkedin/callback')}&scope=openid%20profile%20email`,
      'linkedin-oauth'
    );
  };

  const usedCodes = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GITHUB_CODE') {
        const { code } = event.data as { code: string };
        if (usedCodes.current.has(code)) return;
        usedCodes.current.add(code);
        setIsLoadingGithub(true);

        fetch(
          `${ENV.USERS_SERVICE_BASE_URL}/api/auth/github/callback?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(window.location.origin + '/auth/github/callback')}`,
          { method: 'GET', credentials: 'include' }
        )
          .then(async (res) => {
            if (!res.ok) throw new Error('Authentication failed');
            const data = await res.json() as Record<string, unknown>;
            if (typeof data.accessToken === 'string') setStoredAccessToken(data.accessToken);
            if (data.user) { onLoginSuccess(data.user as User); navigate('/dashboard', { replace: true }); }
          })
          .catch((err: unknown) => { console.error('GitHub login failed:', err); })
          .finally(() => { setIsLoadingGithub(false); });
      }

      if (event.data?.type === 'LINKEDIN_CODE') {
        const { code } = event.data as { code: string };
        if (usedCodes.current.has(code)) return;
        usedCodes.current.add(code);
        setIsLoadingLinkedIn(true);

        const redirectUri = `${window.location.origin}/auth/linkedin/callback`;
        fetch(
          `${ENV.USERS_SERVICE_BASE_URL}/api/auth/linkedin/callback?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(redirectUri)}`,
          { method: 'GET', credentials: 'include' }
        )
          .then(async (res) => {
            if (!res.ok) throw new Error('Authentication failed');
            const data = await res.json() as Record<string, unknown>;
            if (typeof data.accessToken === 'string') setStoredAccessToken(data.accessToken);
            if (data.user) { onLoginSuccess(data.user as User); navigate('/dashboard', { replace: true }); }
          })
          .catch((err: unknown) => { console.error('LinkedIn login failed:', err); })
          .finally(() => { setIsLoadingLinkedIn(false); });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess, navigate]);

  return (
    <div className="login-container">
      <Card>
        <div className="card-header">
          <h2 className="card-title">Welcome to CareerCoach</h2>
          <p className="card-subtitle">Your smart career management platform</p>
        </div>

        <ButtonToggle activeButton={activeButton} onButtonClick={handleButtonClick} />

        <div className="form-wrapper">
          {activeButton === Login.signIn
            ? <SignIn onLoginSuccess={onLoginSuccess} />
            : <SignUp onLoginSuccess={onLoginSuccess} />}
        </div>

        <div className="social-login-section">
          <div className="divider">
            <span>Or continue with</span>
          </div>

          <button
            type="button"
            onClick={loginWithGithub}
            className="github-btn-styled"
            disabled={!ENV.GITHUB_CLIENT_ID || isLoadingGithub}
            title={!ENV.GITHUB_CLIENT_ID ? 'GitHub OAuth not configured - set VITE_CLIENT_ID in .env' : 'Continue with GitHub'}
          >
            <img className="github-icon" src={githubIcon} alt="" aria-hidden="true" />
            {isLoadingGithub ? 'Logging in...' : 'Continue with GitHub'}
          </button>

          <button
            type="button"
            onClick={loginWithLinkedIn}
            className="linkedin-btn-styled"
            disabled={!LINKEDIN_CLIENT_ID || isLoadingLinkedIn}
            title={!LINKEDIN_CLIENT_ID ? 'LinkedIn OAuth not configured - set VITE_LINKEDIN_CLIENT_ID in .env' : 'Continue with LinkedIn'}
          >
            <img className="linkedin-icon" src={linkedInIcon} alt="" aria-hidden="true" />
            {isLoadingLinkedIn ? 'Logging in...' : 'Continue with LinkedIn'}
          </button>
        </div>
      </Card>
    </div>
  );
};
