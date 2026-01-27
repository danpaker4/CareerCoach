import { Link } from 'react-router-dom';
import './Header.css';

interface HeaderProps {
    userName?: string;
}

export default function Header({ userName }: HeaderProps) {
    return (
        <header className="navbar">
            <div className="logo" style={{ fontWeight: 'bold', fontSize: '1.5rem', color: '#2563eb' }}>
                CareerCoach
            </div>
            
            <nav className="nav-links">
                <Link to="/">Home</Link>
                {userName && <Link to="/roadmap">My Roadmap</Link>}
            </nav>

            <div className="auth-buttons">
                {userName ? (
                    <div className="user-welcome">👋 Hi, {userName}</div>
                ) : (
                    <Link to="/login" className="btn-primary">
                        Log In / Sign Up
                    </Link>
                )}
            </div>
        </header>
    );
}