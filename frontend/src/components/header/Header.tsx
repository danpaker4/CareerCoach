import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import iconRoadmap from '../../assets/icon-roadmap.svg';
import iconZap from '../../assets/icon-zap.svg';
import iconKanban from '../../assets/icon-kanban.svg';
import iconTarget from '../../assets/icon-target.svg';
import iconSparkle from '../../assets/icon-sparkle.svg';
import iconMenu from '../../assets/icon-menu.svg';
import iconX from '../../assets/icon-x.svg';
import './Header.css';

interface HeaderProps {
  userName?: string;
  onLogout: () => void;
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const Header = ({ userName, onLogout }: HeaderProps) => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const homePath = userName ? '/dashboard' : '/';

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const navLinks = (
    <>
      {userName && (
        <>
          <Link to="/roadmap" className={`nav-link${isActive('/roadmap') ? ' nav-link--active' : ''}`}>
            <img src={iconRoadmap} alt="" aria-hidden="true" className="nav-icon" />
            My Roadmap
          </Link>
          <Link to="/skill-matcher" className={`nav-link${isActive('/skill-matcher') ? ' nav-link--active' : ''}`}>
            <img src={iconZap} alt="" aria-hidden="true" className="nav-icon" />
            Skill Tracker
          </Link>
          <Link to="/pipeline" className={`nav-link${isActive('/pipeline') ? ' nav-link--active' : ''}`}>
            <img src={iconKanban} alt="" aria-hidden="true" className="nav-icon" />
            My Pipeline
          </Link>
          <Link to="/my-skills" className={`nav-link${isActive('/my-skills') ? ' nav-link--active' : ''}`}>
            <img src={iconTarget} alt="" aria-hidden="true" className="nav-icon" />
            My Skills
          </Link>
          <Link to="/job-suggestions" className={`nav-link${isActive('/job-suggestions') ? ' nav-link--active' : ''}`}>
            <img src={iconSparkle} alt="" aria-hidden="true" className="nav-icon" />
            Jobs
          </Link>
        </>
      )}
    </>
  );

  return (
    <header className="navbar" ref={menuRef}>
      <div className="navbar-brand">
        <Link to={homePath} className="brand-link">
          <span className="brand-text">CareerCoach</span>
        </Link>
      </div>

      <nav className="navbar-nav">{navLinks}</nav>

      <div className="navbar-auth">
        {userName ? (
          <div className="user-area">
            <Link
              to="/profile"
              className={`user-profile-link${isActive('/profile') ? ' user-profile-link--active' : ''}`}
              aria-current={isActive('/profile') ? 'page' : undefined}
            >
              <div className="user-avatar" aria-hidden="true">{getInitials(userName)}</div>
              <span className="user-name">{userName}</span>
            </Link>
            <button type="button" className="btn-logout" onClick={onLogout}>Logout</button>
          </div>
        ) : (
          <Link to="/login" className="btn-login-cta">Log In / Sign Up</Link>
        )}
      </div>

      <button
        type="button"
        className="hamburger"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        <img src={menuOpen ? iconX : iconMenu} alt="" aria-hidden="true" className="hamburger-icon" />
      </button>

      {menuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav" onClick={() => setMenuOpen(false)}>
            {navLinks}
          </nav>
          <div className="mobile-auth">
            {userName ? (
              <>
                <Link
                  to="/profile"
                  className={`mobile-user user-profile-link${isActive('/profile') ? ' user-profile-link--active' : ''}`}
                  aria-current={isActive('/profile') ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="user-avatar" aria-hidden="true">{getInitials(userName)}</div>
                  <span className="user-name">{userName}</span>
                </Link>
                <button type="button" className="btn-logout mobile-logout" onClick={onLogout}>
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-login-cta mobile-login-cta" onClick={() => setMenuOpen(false)}>
                Log In / Sign Up
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
