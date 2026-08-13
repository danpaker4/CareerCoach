import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJobsByTitle, saveDestinationToWishlist } from './career-roadmap-job-search.utils';
import type { DestinationJobResult } from './career-roadmap-job-search.utils';

type DestinationJobSearchProps = {
  userId: string;
  defaultJobTitle: string;
};

export const DestinationJobSearch = ({ userId, defaultJobTitle }: DestinationJobSearchProps) => {
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState(defaultJobTitle);
  const [jobs, setJobs] = useState<DestinationJobResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wishlistState, setWishlistState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setJobs([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    fetchJobsByTitle(userId, trimmedQuery)
      .then((results) => setJobs(results))
      .catch(() => setError('Could not search jobs'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    setSearchQuery(defaultJobTitle);
    if (expanded) {
      runSearch(defaultJobTitle);
    }
  }, [defaultJobTitle, expanded, runSearch]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setWishlistState('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(value);
    }, 600);
  };

  const handleAddToWishlist = async () => {
    setWishlistState('saving');
    try {
      const saved = await saveDestinationToWishlist(userId, searchQuery);
      setWishlistState(saved ? 'saved' : 'error');
    } catch {
      setWishlistState('error');
    }
  };

  return (
    <div className="journey-destination-search">
      <button
        type="button"
        className="journey-destination-search-toggle"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        Search jobs for your destination role
      </button>
      {expanded && (
        <div className="journey-destination-search-body">
          <label className="journey-destination-search-label" htmlFor="destination-job-search">
            Job title to search
          </label>
          <input
            id="destination-job-search"
            type="search"
            className="journey-destination-search-input"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
            aria-label="Search jobs by role name"
          />
          {loading && <p className="journey-destination-search-status">Searching for matching roles...</p>}
          {error && <p className="journey-destination-search-error">{error}</p>}
          {!loading && !error && searchQuery.trim() && jobs.length === 0 && (
            <div className="journey-destination-search-empty">
              <p>There are no jobs available in our job listings right now. Do you want to add this role to your wishlist?</p>
              <button
                type="button"
                className="btn-outline journey-destination-wishlist-button"
                onClick={() => void handleAddToWishlist()}
                disabled={wishlistState === 'saving' || wishlistState === 'saved'}
              >
                {wishlistState === 'saving' ? 'Saving…' : wishlistState === 'saved' ? 'Added to wishlist' : 'Add to wishlist'}
              </button>
              {wishlistState === 'error' && (
                <p className="journey-destination-search-error">Could not add this role to your wishlist. Please try again.</p>
              )}
            </div>
          )}
          {!loading && jobs.length > 0 && (
            <ul className="journey-opportunities-list">
              {jobs.map((job) => (
                <li key={job.id} className="journey-opportunity-item">
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="journey-opportunity-link">
                    <span className="journey-opportunity-title">{job.jobTitle}</span>
                    <span className="journey-opportunity-meta">
                      {job.company} · {job.seniority}
                      {job.matchPct !== undefined ? ` · ${job.matchPct}% fit` : ''}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
