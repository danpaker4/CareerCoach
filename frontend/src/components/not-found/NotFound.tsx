import { useNavigate } from 'react-router-dom';
import './NotFound.css';

export const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <div className="not-found-code">404</div>
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-sub">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="not-found-actions">
          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Go Home
          </button>
          <button type="button" className="btn-outline" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};
