import { describe, expect, it } from 'vitest';
import type { CareerRoadmapData } from '../career-roadmap/career-roadmap.types';
import {
  buildSkillSetsFromRoadmaps,
  summarizeSkillProgress,
  toggleRoadmapAction,
} from './skill-matcher-from-roadmap.utils';

const sampleRoadmap = (): CareerRoadmapData => ({
  id: 'rm-1',
  userId: 'user-1',
  dreamJob: 'Security Engineer',
  stagesToDreamJob: [
    {
      jobId: 1,
      isDone: false,
      completedActions: ['Learn networking basics'],
      content: {
        label: 'Foundations',
        description: 'Start here',
        actions: ['Learn networking basics', 'Study Linux'],
      },
    },
    {
      jobId: 2,
      isDone: true,
      completedActions: ['Get SOC role'],
      content: {
        label: 'First job',
        description: 'Gain experience',
        actions: ['Get SOC role'],
      },
    },
  ],
});

describe('skill-matcher-from-roadmap.utils', () => {
  it('maps every roadmap action checkbox into skill tracker sets with done state', () => {
    const sets = buildSkillSetsFromRoadmaps([sampleRoadmap()]);
    expect(sets).toHaveLength(2);
    expect(sets[0]?.stageLabel).toBe('Foundations');
    expect(sets[0]?.skillToImprove).toEqual([
      { skill: 'Learn networking basics', isDone: true },
      { skill: 'Study Linux', isDone: false },
    ]);
    expect(sets[1]?.skillToImprove).toEqual([{ skill: 'Get SOC role', isDone: true }]);
  });

  it('computes overall percentage across all checkboxes', () => {
    const sets = buildSkillSetsFromRoadmaps([sampleRoadmap()]);
    expect(summarizeSkillProgress(sets)).toEqual({ total: 3, done: 2, pct: 67 });
  });

  it('toggles a checkbox and marks the stage done when all actions complete', () => {
    const next = toggleRoadmapAction({
      roadmaps: [sampleRoadmap()],
      roadmapId: 'rm-1',
      stageIndex: 0,
      action: 'Study Linux',
    });
    const stage = next[0]?.stagesToDreamJob[0];
    expect(stage?.completedActions).toEqual(['Learn networking basics', 'Study Linux']);
    expect(stage?.isDone).toBe(true);
  });
});
