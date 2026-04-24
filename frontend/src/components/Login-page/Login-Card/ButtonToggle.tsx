import { Login, type LoginType } from '../../../types/login'
import './ButtonToggle.css'

interface ButtonToggleProps {
  activeButton: LoginType
  onButtonClick: (button: LoginType) => void
}

export const ButtonToggle = ({ activeButton, onButtonClick }: ButtonToggleProps) => {
  return (
    <div className="button-toggle">
      <button
        type="button"
        className={`toggle-button ${activeButton === Login.signIn ? 'active' : ''}`}
        onClick={() => onButtonClick(Login.signIn)}
      >
        Log In
      </button>
      <button
        type="button"
        className={`toggle-button ${activeButton === Login.signUp ? 'active' : ''}`}
        onClick={() => onButtonClick(Login.signUp)}
      >
        Sign Up
      </button>
    </div>
  )
}

