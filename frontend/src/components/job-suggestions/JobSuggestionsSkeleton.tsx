import './JobSuggestionsSkeleton.css';

const SKELETON_CARD_IDS = ['job-skeleton-1', 'job-skeleton-2', 'job-skeleton-3', 'job-skeleton-4'] as const;

export const JobSuggestionsSkeleton = () => (
  <div className="job-suggestions-skeleton" role="status" aria-live="polite">
    <span className="job-suggestions-skeleton__status">Loading job suggestions</span>

    <div className="job-suggestions-skeleton__count skeleton-shimmer" aria-hidden="true" />

    <div className="job-suggestions-skeleton__grid" aria-hidden="true">
      {SKELETON_CARD_IDS.map((cardId) => (
        <div key={cardId} className="job-suggestions-skeleton__card surface-card">
          <div className="job-suggestions-skeleton__details">
            <div className="job-suggestions-skeleton__title skeleton-shimmer" />
            <div className="job-suggestions-skeleton__company skeleton-shimmer" />
            <div className="job-suggestions-skeleton__seniority skeleton-shimmer" />
          </div>

          <div className="job-suggestions-skeleton__requirements">
            <div className="job-suggestions-skeleton__requirement skeleton-shimmer" />
            <div className="job-suggestions-skeleton__requirement job-suggestions-skeleton__requirement--short skeleton-shimmer" />
          </div>

          <div className="job-suggestions-skeleton__actions">
            <div className="job-suggestions-skeleton__button skeleton-shimmer" />
            <div className="job-suggestions-skeleton__button skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  </div>
);
