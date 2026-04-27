import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import './PageTransition.css';

interface PageTransitionProps {
  children: ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();

  return (
    <div className="page-transition" key={location.pathname}>
      {children}
    </div>
  );
};
