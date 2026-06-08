import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { Management } from './components/management/Management';
import { ManagementBenchmarks } from './components/management/ManagementBenchmarks';
import { ManagementLlmEvaluation } from './components/management/ManagementLlmEvaluation';
import { ManagementRateLimits } from './components/management/ManagementRateLimits';
import { ManagementUsage } from './components/management/ManagementUsage';
import { ManagementUsers } from './components/management/ManagementUsers';
import { GithubCallback } from './components/github-callback/GithubCallback';
import { LinkedInCallback } from './components/linkedin-callback/LinkedInCallback';
import { ChatPage } from './components/chat-page/ChatPage';
import { NotFound } from './components/not-found/NotFound';
import { PageTransition } from './components/page-transition/PageTransition';
import { apiFetch, refreshAccessToken } from './lib/apiClient';
import { ENV } from './config';
import type { User } from './types/user';
import { normalizeUser } from './lib/authResponse';
import { clearStoredAccessToken } from './lib/authSession';
import { applyTheme, readInitialTheme, type ThemeMode } from './lib/theme';

const AUTH_LOGOUT_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/auth/logout`;
const AUTH_USER_STORAGE_KEY = 'career_coach_current_user';

const readStoredUser = (): User | null => {
  const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed: unknown = JSON.parse(raw);
  return normalizeUser(parsed);
};

const persistUser = (user: User | null): void => {
  if (!user) {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
};

interface ProtectedRouteProps {
  user: User | null | undefined;
  children: ReactNode;
}

interface AdminRouteProps extends ProtectedRouteProps {
  sessionVerified: boolean;
}

const ProtectedRoute = ({ user, children }: ProtectedRouteProps) => {
  if (user === undefined) return null;
  if (user === null) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ user, sessionVerified, children }: AdminRouteProps) => {
  if (user === undefined) return null;
  if (user === null) return <Navigate to="/login" replace />;
  if (!sessionVerified) return null;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppLoader = () => (
  <div className="app-loader">
    <div className="spinner" />
  </div>
);

export const App = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => readInitialTheme());
  const [sessionVerified, setSessionVerified] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(() => {
    try {
      return readStoredUser() ?? undefined;
    } catch {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      return undefined;
    }
  });
  const userDisplayName = currentUser
    ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ')
    : undefined;

  const bootstrapRan = useRef(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (bootstrapRan.current) {
      return;
    }
    bootstrapRan.current = true;

    const loadCurrentUser = async () => {
      const user = await refreshAccessToken();
      if (!user) {
        clearStoredAccessToken();
        persistUser(null);
        setCurrentUser(null);
        setSessionVerified(true);
        return;
      }

      persistUser(user);
      setCurrentUser(user);
      setSessionVerified(true);
    };

    loadCurrentUser().catch(() => {
      clearStoredAccessToken();
      persistUser(null);
      setCurrentUser(null);
      setSessionVerified(true);
    });
  }, []);

  const handleLoginSuccess = (user: User) => {
    persistUser(user);
    setCurrentUser(user);
    setSessionVerified(true);
  };

  const handleLogout = async () => {
    await apiFetch(AUTH_LOGOUT_PATH, { method: 'POST' });
    clearStoredAccessToken();
    persistUser(null);
    setCurrentUser(null);
    window.location.assign('/login');
  };

  if (currentUser === undefined) {
    return <AppLoader />;
  }

  return (
    <Router>
      <div className="App">
        <Header
          userName={userDisplayName}
          isAdmin={sessionVerified && currentUser?.role === 'admin'}
          theme={theme}
          onToggleTheme={() => setTheme((currentTheme) => currentTheme === 'light' ? 'dark' : 'light')}
        />

        <PageTransition>
          <Routes>
            <Route path="/" element={currentUser ? <Navigate to="/dashboard" replace /> : <Home />} />

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
                    ? <Profile user={currentUser} onUserUpdated={(u) => {
                      persistUser(u);
                      setCurrentUser(u);
                    }} onLogout={handleLogout} />
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
              path="/chat"
              element={
                <ProtectedRoute user={currentUser}>
                  {currentUser ? <ChatPage user={currentUser} /> : null}
                </ProtectedRoute>
              }
            />

            <Route
              path="/management"
              element={
                <AdminRoute user={currentUser} sessionVerified={sessionVerified}>
                  <Management />
                </AdminRoute>
              }
            />

            <Route
              path="/management/usage"
              element={
                <AdminRoute user={currentUser} sessionVerified={sessionVerified}>
                  <ManagementUsage />
                </AdminRoute>
              }
            />

            <Route
              path="/management/users"
              element={
                <AdminRoute user={currentUser} sessionVerified={sessionVerified}>
                  {currentUser ? <ManagementUsers currentUser={currentUser} /> : null}
                </AdminRoute>
              }
            />

            <Route
              path="/management/benchmarks"
              element={
                <AdminRoute user={currentUser} sessionVerified={sessionVerified}>
                  <ManagementBenchmarks />
                </AdminRoute>
              }
            />

            <Route
              path="/management/rate-limits"
              element={
                <AdminRoute user={currentUser} sessionVerified={sessionVerified}>
                  <ManagementRateLimits />
                </AdminRoute>
              }
            />

            <Route
              path="/management/llm-evaluation"
              element={
                <AdminRoute user={currentUser} sessionVerified={sessionVerified}>
                  <ManagementLlmEvaluation />
                </AdminRoute>
              }
            />

            <Route
              path="/auth/github/callback"
              element={<GithubCallback onLoginSuccess={handleLoginSuccess} />}
            />

            <Route
              path="/auth/linkedin/callback"
              element={<LinkedInCallback onLoginSuccess={handleLoginSuccess} />}
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
