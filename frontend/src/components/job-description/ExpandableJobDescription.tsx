import { useId, useState } from 'react';
import type { ExpandableJobDescriptionProps } from './expandable-job-description.types';
import { createJobDescriptionPreview } from './expandable-job-description.utils';
import './ExpandableJobDescription.css';

export const ExpandableJobDescription = ({ description }: ExpandableJobDescriptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const descriptionId = useId();
  const preview = createJobDescriptionPreview(description);
  const displayedDescription = isExpanded ? description.trim() : preview.text;

  if (!displayedDescription) {
    return null;
  }

  return (
    <div className="expandable-job-description">
      <p id={descriptionId} className="expandable-job-description__text">{displayedDescription}</p>
      {preview.isTruncated && (
        <button
          type="button"
          className="expandable-job-description__toggle"
          aria-expanded={isExpanded}
          aria-controls={descriptionId}
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
        >
          {isExpanded ? 'Show less' : 'Load more'}
        </button>
      )}
    </div>
  );
};
