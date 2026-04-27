import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { Header } from './components/header/Header';
import { Home } from './components/home-page/Home';
import { LoginPage } from './components/Login-page/Login-page';
import { CareerRoadmap } from './components/career-roadmap/CareerRoadmap';
import { SkillMatcher } from './components/skill-matcher/SkillMatcher';
import { Pipeline } from './components/pipeline/Pipeline';
import { Profile } from './components/profile/Profile';
import { Dashboard } from './components/dashboard/Dashboard';
import { MySkills } from './components/my-skills/MySkills';
import { JobSuggestions } from './components/job-suggestions/JobSuggestions';
import { GithubCallback } from './components/github-callback/GithubCallback';
import { NotFound } from './components/not-found/NotFound';
import { PageTransition } from './components/page-transition/PageTransition';
import { apiFetch } from './lib/apiClient';
import { ENV } from './config';
import type { User } from './types/user';
import { readUserResponse } from './App.utils';
import { clearStoredAccessToken, getStoredAccessToken } from './lib/authSession';

const AUTH_ME_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/me`;
const AUTH_LOGOUT_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/logout`;

interface ProtectedRouteProps {
  user: User | null | undefined;
  children: ReactNode;
}

const ProtectedRoute = ({ user, children }: ProtectedRouteProps) => {
  if (user === undefined) return null;
  if (user === null) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppLoader = () => (
  <div className="app-loader">
    <div className="spinner" />
  </div>
);

export const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);

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

  if (currentUser === undefined) {
    return <AppLoader />;
  }

  return (
    <Router>
      <div className="App">
        <Header userName={userDisplayName} onLogout={handleLogout} />

        <PageTransition>
          <Routes>
            <Route path="/" element={<Home />} />

            <Route
              path="/login"
              element={
                currentUser ? <Navigate to="/dashboard" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} />
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute user={currentUser}>
                  {currentUser ? <Dashboard user={currentUser} /> : null}
                </ProtectedRoute>
              }
            />

            <Route
              path="/roadmap"
              element={
                <ProtectedRoute user={currentUser}>
                  <CareerRoadmap user={currentUser ?? undefined} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/skill-matcher"
              element={
                <ProtectedRoute user={currentUser}>
                  <SkillMatcher user={currentUser ?? undefined} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pipeline"
              element={
                <ProtectedRoute user={currentUser}>
                  <Pipeline user={currentUser ?? undefined} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute user={currentUser}>
                  {currentUser
                    ? <Profile user={currentUser} onUserUpdated={(u) => setCurrentUser(u)} />
                    : null}
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-skills"
              element={
                <ProtectedRoute user={currentUser}>
                  {currentUser ? <MySkills user={currentUser} /> : null}
                </ProtectedRoute>
              }
            />

            <Route
              path="/job-suggestions"
              element={
                <ProtectedRoute user={currentUser}>
                  {currentUser ? <JobSuggestions user={currentUser} /> : null}
                </ProtectedRoute>
              }
            />

            <Route
              path="/auth/github/callback"
              element={<GithubCallback onLoginSuccess={handleLoginSuccess} />}
            />

            <Route path="/signup" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
      </div>
    </Router>
  );
};

export default App;
