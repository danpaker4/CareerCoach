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
import { setStoredAccessToken } from '../../lib/authSession'
import { useNavigate } from 'react-router-dom'

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const [activeButton, setActiveButton] = useState<LoginType>(Login.signIn)
  const isSignUpView = activeButton === Login.signUp
  const navigate = useNavigate();
  const [isLoadingGithub, setIsLoadingGithub] = useState(false);

  const handleButtonClick = (button: LoginType) => setActiveButton(button)

  const loginWithGithub = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    window.open(
      `https://github.com/login/oauth/authorize?client_id=${ENV.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/github/callback')}&scope=read:user%20user:email&prompt=select_account`,
      'github-oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const usedCodes = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GITHUB_CODE') {
        const { code } = event.data;
        if (usedCodes.current.has(code)) return;
        
        usedCodes.current.add(code);
        setIsLoadingGithub(true);

        fetch(
          `${ENV.USERS_SERVICE_BASE_URL}/api/auth/github/callback?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(window.location.origin + '/auth/github/callback')}`,
          {
            method: 'GET',
            credentials: 'include',
          }
        )
        .then(async (res) => {
          if (!res.ok) throw new Error('Authentication failed');
          const data: any = await res.json();
          if (data.accessToken) {
            setStoredAccessToken(data.accessToken);
          }
          if (data.user) {
            onLoginSuccess(data.user);
            navigate('/dashboard', { replace: true });
          }
        })
        .catch(err => {
          console.error('GitHub login failed:', err);
        })
        .finally(() => {
          setIsLoadingGithub(false);
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess, navigate]);

  return (
    <div className="login-container">
      <Card className={isSignUpView ? 'auth-card auth-card--signup' : 'auth-card'}>
        <div className="card-header">
          <h2 className="card-title">Welcome to CareerCoach</h2>
          <p className="card-subtitle">Your smart career management platform</p>
        </div>
        
        <ButtonToggle activeButton={activeButton} onButtonClick={handleButtonClick} />

        <div className="form-wrapper">
            {activeButton === Login.signIn 
                ? <SignIn onLoginSuccess={onLoginSuccess} /> 
                : <SignUp onLoginSuccess={onLoginSuccess} />
            }
        </div>

        <div className="social-login-section">
          <div className="divider">
            <span>OR</span>
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

        </div>
      </Card>
    </div>
  )
}
