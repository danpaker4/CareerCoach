import { useState } from 'react'
import Card from '../Card/Card'
import ButtonToggle from '../Card/ButtonToggle'
import SignIn from './signIn-component/SignIn'
import SignUp from './signUp-component/SignUp'
import { Login, type LoginType } from '../../types/login'
import './Login-page.css'

function LoginPage() {
  const [activeButton, setActiveButton] = useState<LoginType>(Login.signIn)

  const handleButtonClick = (button: LoginType) => {
    setActiveButton(button)
  }

  return (
    <div className="login-container">
      <Card>
        <div className="card-header">
          <div className="card-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="#2563eb"/>
              <path d="M8 7V5C8 4.46957 8.21071 3.96086 8.58579 3.58579C8.96086 3.21071 9.46957 3 10 3H14C14.5304 3 15.0391 3.21071 15.4142 3.58579C15.7893 3.96086 16 4.46957 16 5V7M8 7H6C5.46957 7 4.96086 7.21071 4.58579 7.58579C4.21071 7.96086 4 8.46957 4 9V18C4 18.5304 4.21071 19.0391 4.58579 19.4142C4.96086 19.7893 5.46957 20 6 20H18C18.5304 20 19.0391 19.7893 19.4142 19.4142C19.7893 19.0391 20 18.5304 20 18V9C20 8.46957 19.7893 7.96086 19.4142 7.58579C19.0391 7.21071 18.5304 7 18 7H16M8 7H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="card-title">Welcome to CareerCoach</h2>
          <p className="card-subtitle">Your smart career management platform</p>
        </div>
        <ButtonToggle activeButton={activeButton} onButtonClick={handleButtonClick} />
        {activeButton === Login.signIn ? <SignIn /> : <SignUp />}
      </Card>
    </div>
  )
}

export default LoginPage
