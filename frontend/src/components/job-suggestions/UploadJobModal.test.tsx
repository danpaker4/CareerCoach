import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadJobModal } from './UploadJobModal';

describe('UploadJobModal focus behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('focuses the first field without scrolling the page', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');

    const { unmount } = render(<UploadJobModal onClose={() => undefined} onCreated={() => undefined} />);

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    });
    const dialog = screen.getByRole('dialog', { name: 'Upload a job' });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
