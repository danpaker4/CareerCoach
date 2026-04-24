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
import { hasErrorCode, readUserResponse } from './App.utils';

const AUTH_ME_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/me`;
const AUTH_REFRESH_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/refresh`;
const AUTH_LOGOUT_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/logout`;

export const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const userDisplayName = currentUser
    ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ')
    : undefined;

  useEffect(() => {
    const fetchCurrentUser = () => fetch(AUTH_ME_PATH, { credentials: 'include' });

    const refreshAccessToken = () => fetch(AUTH_REFRESH_PATH, {
      method: 'POST',
      credentials: 'include',
    });

    const loadCurrentUser = async () => {
      const response = await fetchCurrentUser();
      if (response.ok) {
        setCurrentUser(await readUserResponse(response));
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      if (!hasErrorCode(payload, 'ACCESS_TOKEN_EXPIRED')) {
        setCurrentUser(null);
        return;
      }

      const refreshResponse = await refreshAccessToken();
      if (!refreshResponse.ok) {
        setCurrentUser(null);
        return;
      }

      const retryResponse = await fetchCurrentUser();
      setCurrentUser(retryResponse.ok ? await readUserResponse(retryResponse) : null);
    };

    loadCurrentUser().catch(() => setCurrentUser(null));
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await apiFetch(AUTH_LOGOUT_PATH, { method: 'POST' });
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