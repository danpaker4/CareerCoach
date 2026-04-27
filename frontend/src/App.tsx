import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { Header } from './components/header/Header';
import { Home } from './components/home-page/Home';
import { LoginPage } from './components/Login-page/Login-page';
import { CareerRoadmap } from './components/career-roadmap/CareerRoadmap';
import { apiFetch } from './lib/apiClient';
import { ENV } from './config';
import type { User } from './types/user';
import { readUserResponse } from './App.utils';
import { clearStoredAccessToken, getStoredAccessToken } from './lib/authSession';

const AUTH_ME_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/me`;
const AUTH_LOGOUT_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/logout`;

export const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const userDisplayName = currentUser
    ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ')
    : undefined;

  useEffect(() => {
    const loadCurrentUser = async () => {
      const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/signup';
      if (isAuthPage && !getStoredAccessToken()) {
        setCurrentUser(null);
        return;
      }

      const response = await apiFetch(AUTH_ME_PATH);
      setCurrentUser(response.ok ? await readUserResponse(response) : null);
    };

    loadCurrentUser().catch(() => setCurrentUser(null));
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await apiFetch(AUTH_LOGOUT_PATH, { method: 'POST' });
    clearStoredAccessToken();
    setCurrentUser(null);
    window.location.assign('/login');
  };

  return (
    <Router>
      <div className="App">

        <Header userName={userDisplayName} onLogout={handleLogout} /> 
        
        <Routes>
          <Route path="/" element={<Home />} />

          <Route 
            path="/login" 
            element={
              currentUser ? <Navigate to="/roadmap" /> : <LoginPage onLoginSuccess={handleLoginSuccess} />
            } 
          />
          
          <Route 
            path="/roadmap" 
            element={<CareerRoadmap user={currentUser || undefined} />} 
          />
          
          <Route path="/signup" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
