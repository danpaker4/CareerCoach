import { useEffect } from 'react';
import {
  DELETE_USER_DIALOG_CANCEL_LABEL,
  DELETE_USER_DIALOG_CONFIRM_LABEL,
  DELETE_USER_DIALOG_DELETING_LABEL,
  DELETE_USER_DIALOG_TITLE,
  DELETE_USER_DIALOG_WARNING,
} from './management.consts';
import type { DeleteUserDialogProps } from './management.types';
import { getAdminUserDisplayName } from './management.utils';

export const DeleteUserDialog = ({ user, isDeleting, onCancel, onConfirm }: DeleteUserDialogProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div
      className="management-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
    >
      <section
        className="management-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-dialog-title"
        aria-describedby="delete-user-dialog-description"
      >
        <div className="management-dialog-icon" aria-hidden="true">!</div>
        <div className="management-dialog-content">
          <h2 id="delete-user-dialog-title">{DELETE_USER_DIALOG_TITLE}</h2>
          <p id="delete-user-dialog-description">
            Delete <strong>{getAdminUserDisplayName(user)}</strong> ({user.email})?
          </p>
          <p className="management-dialog-warning">{DELETE_USER_DIALOG_WARNING}</p>
        </div>
        <div className="management-dialog-actions">
          <button
            type="button"
            className="btn-outline management-dialog-cancel"
            disabled={isDeleting}
            onClick={onCancel}
          >
            {DELETE_USER_DIALOG_CANCEL_LABEL}
          </button>
          <button
            type="button"
            className="btn-primary management-dialog-confirm"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? DELETE_USER_DIALOG_DELETING_LABEL : DELETE_USER_DIALOG_CONFIRM_LABEL}
          </button>
        </div>
      </section>
    </div>
  );
};
