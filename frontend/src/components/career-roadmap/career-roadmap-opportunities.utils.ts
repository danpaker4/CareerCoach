import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import type { StageOpportunitiesResponse } from './career-roadmap.types';

export const fetchStageOpportunities = async (
  roleCategories: string[],
  userSkills: string[] | undefined,
  page: number
): Promise<StageOpportunitiesResponse> => {
  if (roleCategories.length === 0) {
    return { opportunities: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } };
  }

  const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/opportunities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      roleCategories,
      ...(userSkills && userSkills.length > 0 ? { userSkills } : {}),
      page,
      pageSize: 10,
    }),
  });

  if (!res.ok) throw new Error('Failed to load jobs');
  const data: unknown = await res.json();
  if (typeof data !== 'object' || data === null || !('opportunities' in data) || !('pagination' in data)) {
    throw new Error('Invalid jobs response');
  }
  return data as StageOpportunitiesResponse;
};
