import { useState } from 'react'
import { ENV } from '../../config'
import { Login, type LoginType } from '../../types/login'
import './Login-page.css'
import { SignIn } from './signIn-component/SignIn'
import { SignUp } from './signUp-component/SignUp'
import { Card } from './Login-Card/Card'
import { ButtonToggle } from './Login-Card/ButtonToggle'
import type { User } from '../../types/user'
import githubIcon from '../../assets/github-icon.svg'

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const [activeButton, setActiveButton] = useState<LoginType>(Login.signIn)

  const handleButtonClick = (button: LoginType) => setActiveButton(button)

  const loginWithGithub = () => {
    window.location.assign(
      `https://github.com/login/oauth/authorize?client_id=${ENV.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/github/callback')}&scope=user:email`
    );
  };

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
                : <SignUp onLoginSuccess={onLoginSuccess} />
            }
        </div>

        <div className="social-login-section">
          <div className="divider">
            <span>Or continue with</span>
          </div>
          <button
            type="button"
            onClick={loginWithGithub}
            className="github-btn-styled"
            disabled={!ENV.GITHUB_CLIENT_ID}
            title={!ENV.GITHUB_CLIENT_ID ? 'GitHub OAuth not configured - set VITE_CLIENT_ID in .env' : 'Continue with GitHub'}
          >
            <img className="github-icon" src={githubIcon} alt="" aria-hidden="true" />
            GitHub
          </button>

        </div>
      </Card>
    </div>
  )
}