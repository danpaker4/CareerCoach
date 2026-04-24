import { Link } from 'react-router-dom';
import './Header.css';

interface HeaderProps {
    userName?: string;
    onLogout: () => void;
}

export const Header = ({ userName, onLogout }: HeaderProps) => {
    return (
        <header className="navbar">
            <div className="brand">
                <div className="logo">
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
};