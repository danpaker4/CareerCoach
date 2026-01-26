import { Link } from 'react-router-dom';
import './Header.css';

export default function Header() {
    return (
        <header className="navbar">
            <div className="logo">CareerCoach</div>
            <nav className="nav-links">
                <Link to="/">Home</Link>
                <Link to="/about">About</Link>
            </nav>
            <div className="auth-buttons">
                <Link to="/login" className="btn-login">Log In</Link>
                <Link to="/signup" className="btn-signup">Sign Up</Link>
            </div>
        </header>
    );
}