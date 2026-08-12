import { describe, expect, it } from 'vitest';
import { JOB_DESCRIPTION_PREVIEW_LENGTH } from './expandable-job-description.consts';
import { createJobDescriptionPreview } from './expandable-job-description.utils';

describe('expandable job description utilities', () => {
  it('keeps short descriptions unchanged', () => {
    expect(createJobDescriptionPreview('  A concise role description.  ')).toEqual({
      text: 'A concise role description.',
      isTruncated: false,
    });
  });

  it('truncates long descriptions at a word boundary', () => {
    const description = `${'A useful sentence. '.repeat(20)}Final details.`;
    const preview = createJobDescriptionPreview(description);

    expect(preview.isTruncated).toBe(true);
    expect(preview.text.endsWith('…')).toBe(true);
    expect(preview.text.length).toBeLessThanOrEqual(JOB_DESCRIPTION_PREVIEW_LENGTH + 1);
    expect(description.startsWith(preview.text.slice(0, -1))).toBe(true);
  });

  it('truncates a long unbroken value at the preview limit', () => {
    const preview = createJobDescriptionPreview('x'.repeat(JOB_DESCRIPTION_PREVIEW_LENGTH + 10));

    expect(preview.text).toBe(`${'x'.repeat(JOB_DESCRIPTION_PREVIEW_LENGTH)}…`);
    expect(preview.isTruncated).toBe(true);
  });
});
