import { useEffect, useState } from 'react';
import { fetchStageOpportunities } from './career-roadmap-opportunities.utils';
import type { StageOpportunity } from './career-roadmap.types';

type StageOpportunitiesPanelProps = {
  roleCategories: string[];
  userSkills?: string[];
};

export const StageOpportunitiesPanel = ({ roleCategories, userSkills }: StageOpportunitiesPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<StageOpportunity[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!expanded || roleCategories.length === 0) return;
    setLoading(true);
    setError('');
    fetchStageOpportunities(roleCategories, userSkills)
      .then((items) => setOpportunities(items))
      .catch(() => setError('Could not load opportunities'))
      .finally(() => setLoading(false));
  }, [expanded, roleCategories, userSkills]);

  if (roleCategories.length === 0) return null;

  return (
    <div className="journey-opportunities">
      <button
        type="button"
        className="journey-opportunities-toggle"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        Jobs that fit this stage
      </button>
      {expanded && (
        <div className="journey-opportunities-body">
          {loading && <p className="journey-opportunities-loading">Loading jobs for this stage...</p>}
          {error && <p className="journey-opportunities-error">{error}</p>}
          {!loading && !error && opportunities.length === 0 && (
            <p className="journey-opportunities-empty">No matching opportunities found right now.</p>
          )}
          {!loading && opportunities.length > 0 && (
            <ul className="journey-opportunities-list">
              {opportunities.map((item) => (
                <li key={item.jobId} className="journey-opportunity-item">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="journey-opportunity-link">
                    <span className="journey-opportunity-title">{item.title}</span>
                    <span className="journey-opportunity-meta">{item.company} · {item.seniority}</span>
                  </a>
                  <p className="journey-opportunity-reason">{item.relevanceReason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
