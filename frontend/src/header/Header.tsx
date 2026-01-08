import { useNavigate } from 'react-router-dom'
import './Header.css'

function Header() {
  const navigate = useNavigate()

  const handleLoginClick = () => navigate('/login')

  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-logo">CareerCoach</h1>
        <button className="header-button" onClick={handleLoginClick}>
          Log In
        </button>
      </div>
    </header>
  )
}

export default Header
