import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import './PageTransition.css';

interface PageTransitionProps {
  children: ReactNode;
}

const TRANSITION_LOCK_CLASS_NAME = 'route-transition-active';
const TRANSITION_LOCK_TIMEOUT_MS = 320;

export const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.add(TRANSITION_LOCK_CLASS_NAME);

    const timeoutId = window.setTimeout(() => {
      document.documentElement.classList.remove(TRANSITION_LOCK_CLASS_NAME);
    }, TRANSITION_LOCK_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
      document.documentElement.classList.remove(TRANSITION_LOCK_CLASS_NAME);
    };
  }, [location.pathname]);

  return (
    <div className="page-transition" key={location.pathname}>
      {children}
    </div>
  );
};
