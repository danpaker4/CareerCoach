import './ButtonToggle.css'

interface ButtonToggleProps {
  activeButton: 'signIn' | 'signUp'
  onButtonClick: (button: 'signIn' | 'signUp') => void
}

function ButtonToggle({ activeButton, onButtonClick }: ButtonToggleProps) {
  return (
    <div className="button-toggle">
      <button
        className={`toggle-button ${activeButton === 'signIn' ? 'active' : ''}`}
        onClick={() => onButtonClick('signIn')}
      >
        Log In
      </button>
      <button
        className={`toggle-button ${activeButton === 'signUp' ? 'active' : ''}`}
        onClick={() => onButtonClick('signUp')}
      >
        Sign Up
      </button>
    </div>
  )
}

export default ButtonToggle

