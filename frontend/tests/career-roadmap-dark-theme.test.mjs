import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/components/career-roadmap/CareerRoadmap.css', 'utf8');
const modalCss = readFileSync('src/components/career-roadmap/CreateRoadmapModal.css', 'utf8');
const LIGHT_ONLY_COLORS = /#fff\b|#ffffff\b|#f8fafc\b|#f5f3ff\b|#eff6ff\b|#fef2f2\b|#fffbeb\b|#dcfce7\b|#ede9fe\b|#eef2f7\b|#cbd5e1\b|#64748b\b/i;

describe('career roadmap dark theme', () => {
  it('uses theme tokens for every newly added roadmap surface and control', () => {
    const start = css.indexOf('.roadmap-path-options {');
    const end = css.indexOf('/* Floating chat launcher', start);
    const jobsStart = css.indexOf('.roadmap-jobs-backdrop {');
    const relevantCss = `${css.slice(start, end)}\n${css.slice(jobsStart)}`;

    expect(start).toBeGreaterThan(-1);
    expect(jobsStart).toBeGreaterThan(-1);
    expect(relevantCss).not.toMatch(LIGHT_ONLY_COLORS);
    expect(relevantCss).toContain('var(--surface-base)');
    expect(relevantCss).toContain('var(--surface-muted)');
    expect(relevantCss).toContain('var(--text-muted)');
    expect(relevantCss).toContain('var(--border-subtle)');
    expect(relevantCss).toContain('var(--input-bg)');
  });

  it('uses dark-aware input tokens in the roadmap preferences form', () => {
    const start = modalCss.indexOf('.roadmap-preferences-grid {');
    const relevantCss = modalCss.slice(start);

    expect(start).toBeGreaterThan(-1);
    expect(relevantCss).not.toMatch(LIGHT_ONLY_COLORS);
    expect(relevantCss).toContain('var(--input-bg)');
    expect(relevantCss).toContain('var(--border-strong)');
  });
});
