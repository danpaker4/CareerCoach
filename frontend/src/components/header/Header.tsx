import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import iconRoadmap from '../../assets/icon-roadmap.svg';
import iconZap from '../../assets/icon-zap.svg';
import iconKanban from '../../assets/icon-kanban.svg';
import iconTarget from '../../assets/icon-target.svg';
import iconSparkle from '../../assets/icon-sparkle.svg';
import iconMessage from '../../assets/icon-message.svg';
import iconUser from '../../assets/icon-user.svg';
import iconMenu from '../../assets/icon-menu.svg';
import iconX from '../../assets/icon-x.svg';
import iconSun from '../../assets/icon-sun.svg';
import iconMoon from '../../assets/icon-moon.svg';
import './Header.css';
import type { HeaderProps } from './header.types';
import { getInitials } from './header.utils';

export const Header = ({ userName, isAdmin = false, theme, onToggleTheme }: HeaderProps) => {
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
          <Link to="/chat" className={`nav-link${isActive('/chat') ? ' nav-link--active' : ''}`}>
            <img src={iconMessage} alt="" aria-hidden="true" className="nav-icon" />
            AI Coach
          </Link>
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
          {isAdmin && (
            <Link to="/management" className={`nav-link${isActive('/management') ? ' nav-link--active' : ''}`}>
              <img src={iconUser} alt="" aria-hidden="true" className="nav-icon" />
              Management
            </Link>
          )}
        </>
      )}
    </>
  );

  const renderThemeToggle = () => (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <img
        src={theme === 'light' ? iconMoon : iconSun}
        alt=""
        aria-hidden="true"
        className="theme-toggle-icon"
      />
      <span className="theme-toggle-label">{theme === 'light' ? 'Dark' : 'Light'}</span>
    </button>
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
            {renderThemeToggle()}
            <Link
              to="/profile"
              className={`user-profile-link${isActive('/profile') ? ' user-profile-link--active' : ''}`}
              aria-current={isActive('/profile') ? 'page' : undefined}
            >
              <div className="user-avatar" aria-hidden="true">{getInitials(userName)}</div>
              <span className="user-name">{userName}</span>
            </Link>
          </div>
        ) : (
          <div className="guest-actions">
            {renderThemeToggle()}
            <Link to="/login" className="btn-login-cta">Log In / Sign Up</Link>
          </div>
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
            {renderThemeToggle()}
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
