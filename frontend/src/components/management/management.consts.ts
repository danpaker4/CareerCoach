import { ENV } from '../../config';

export const ADMIN_USERS_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/admin/users`;
export const ADMIN_PROMOTE_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/admin/admins`;
export const ADMIN_DEMOTE_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/admin/admins`;
export const ADMIN_DELETE_USER_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/admin/users`;
export const ADMIN_LLM_TOKEN_USAGE_PATH = `${ENV.USERS_SERVICE_BASE_URL}/api/admin/llm-token-usage`;
export const EVALUATION_CASES_PATH = `${ENV.EVALUATION_SERVICE_BASE_URL}/evaluation-cases`;

export const EVALUATION_CASE_FILE_FIELD = 'file';
export const EVALUATION_CASE_JSON_ACCEPT = '.json,application/json';

export const MANAGEMENT_USERS_PAGE_SIZE = 25;
export const MANAGEMENT_TOKEN_USAGE_DAYS = [7, 30, 90] as const;

export const MANAGEMENT_LOAD_ERROR_MESSAGE = 'Unable to load users';
export const MANAGEMENT_TOKEN_USAGE_LOAD_ERROR_MESSAGE = 'Unable to load model token usage';
export const MANAGEMENT_PROMOTE_ERROR_MESSAGE = 'Unable to promote user';
export const MANAGEMENT_DEMOTE_ERROR_MESSAGE = 'Unable to demote admin';
export const MANAGEMENT_DELETE_ERROR_MESSAGE = 'Unable to delete user';
export const MANAGEMENT_EVALUATION_LOAD_ERROR_MESSAGE = 'Unable to load evaluation conversations';
export const MANAGEMENT_EVALUATION_UPLOAD_ERROR_MESSAGE = 'Unable to add evaluation conversation';
export const MANAGEMENT_EVALUATION_DELETE_ERROR_MESSAGE = 'Unable to delete evaluation conversation';
export const MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE = 'Unable to run evaluation conversation';
export const MANAGEMENT_EVALUATION_RUN_ALL_ERROR_MESSAGE = 'Unable to complete run all evaluations';
export const MANAGEMENT_EVALUATION_INVALID_FILE_MESSAGE = 'Please choose a .json file';

export const buildEvaluationCaseRunUrl = (caseId: string): string =>
  `${EVALUATION_CASES_PATH}/${encodeURIComponent(caseId)}/run`;

export const DELETE_USER_DIALOG_TITLE = 'Delete user';
export const DELETE_USER_DIALOG_WARNING = 'This action cannot be undone.';
export const DELETE_USER_DIALOG_CANCEL_LABEL = 'Cancel';
export const DELETE_USER_DIALOG_CONFIRM_LABEL = 'Delete user';
export const DELETE_USER_DIALOG_DELETING_LABEL = 'Deleting...';
