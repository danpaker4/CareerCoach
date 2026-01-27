import { useState } from 'react'
import { ENV } from '../../config'
import { Login, type LoginType } from '../../types/login'
import './Login-page.css'
import SignIn from './signIn-component/SignIn'
import SignUp from './signUp-component/SignUp'
import Card from './Login-Card/Card'
import ButtonToggle from './Login-Card/ButtonToggle'
import { User } from '../../App'

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [activeButton, setActiveButton] = useState<LoginType>(Login.signIn)

  const handleButtonClick = (button: LoginType) => setActiveButton(button)

  const loginWithGithub = () => {
    if (ENV.GITHUB_CLIENT_ID) {
        window.location.assign(`https://github.com/login/oauth/authorize?client_id=${ENV.GITHUB_CLIENT_ID}&prompt=consent`)
    } else {
        alert("Github Client ID is missing configuration");
    }
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
            
            <button onClick={loginWithGithub} className="github-btn-styled">
                <svg height="20" viewBox="0 0 16 16" version="1.1" width="20" aria-hidden="true" fill="currentColor" style={{marginRight: '10px'}}>
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                </svg>
                GitHub
            </button>
        </div>
      </Card>
    </div>
  )
}

export default LoginPage