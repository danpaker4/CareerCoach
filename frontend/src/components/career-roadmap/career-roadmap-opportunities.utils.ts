import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import type { StageOpportunitiesResponse } from './career-roadmap.types';

export const fetchStageOpportunities = async (
  roleCategories: string[],
  userSkills?: string[]
): Promise<StageOpportunitiesResponse['opportunities']> => {
  if (roleCategories.length === 0) return [];

  const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/career-roadmap/opportunities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      roleCategories,
      ...(userSkills && userSkills.length > 0 ? { userSkills } : {}),
      limit: 6,
    }),
  });

  if (!res.ok) return [];
  const data: unknown = await res.json();
  if (typeof data !== 'object' || data === null || !('opportunities' in data)) return [];
  const opportunities = (data as StageOpportunitiesResponse).opportunities;
  return Array.isArray(opportunities) ? opportunities : [];
};
