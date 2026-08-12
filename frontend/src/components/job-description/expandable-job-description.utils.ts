import { JOB_DESCRIPTION_PREVIEW_LENGTH } from './expandable-job-description.consts';
import type { JobDescriptionPreview } from './expandable-job-description.types';

export const createJobDescriptionPreview = (description: string): JobDescriptionPreview => {
  const normalizedDescription = description.trim();
  if (normalizedDescription.length <= JOB_DESCRIPTION_PREVIEW_LENGTH) {
    return { text: normalizedDescription, isTruncated: false };
  }

  const candidate = normalizedDescription.slice(0, JOB_DESCRIPTION_PREVIEW_LENGTH + 1);
  const lastWordBoundary = candidate.lastIndexOf(' ');
  const previewEnd = lastWordBoundary > 0 ? lastWordBoundary : JOB_DESCRIPTION_PREVIEW_LENGTH;

  return {
    text: `${normalizedDescription.slice(0, previewEnd).trimEnd()}…`,
    isTruncated: true,
  };
};
