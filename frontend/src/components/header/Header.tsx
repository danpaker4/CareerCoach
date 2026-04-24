import { Link } from 'react-router-dom';
import './Header.css';

interface HeaderProps {
    userName?: string;
    onLogout: () => void;
}

export default function Header({ userName, onLogout }: HeaderProps) {
    return (
        <header className="navbar">
            <div className="brand">
                <div className="logo" style={{ fontWeight: 'bold', fontSize: '1.5rem', color: '#2563eb' }}>
                    CareerCoach
                </div>
            </div>
            
            <nav className="nav-links">
                <Link to="/">Home</Link>
                {userName && <Link to="/roadmap">My Roadmap</Link>}
            </nav>

            <div className="auth-buttons">
                {userName ? (
                    <button type="button" className="btn-logout" onClick={onLogout}>
                        Logout ({userName})
                    </button>
                ) : (
                    <Link to="/login" className="btn-primary">
                        Log In / Sign Up
                    </Link>
                )}
            </div>
        </header>
    );
}