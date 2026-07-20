import type { ResourceType } from './career-roadmap.types';

interface PlatformStyle {
  icon: string;
  accentColor: string;
  bgTint: string;
  label: string;
}

interface ResourceTypeStyle {
  label: string;
  color: string;
  bg: string;
}

const PLATFORM_STYLES: Record<string, PlatformStyle> = {
  udemy:               { icon: '🎓', accentColor: '#a435f0', bgTint: '#f3e8ff', label: 'Udemy' },
  coursera:            { icon: '📘', accentColor: '#0056d2', bgTint: '#e8f0fe', label: 'Coursera' },
  youtube:             { icon: '▶️', accentColor: '#ff0000', bgTint: '#fee2e2', label: 'YouTube' },
  leetcode:            { icon: '💻', accentColor: '#ffa116', bgTint: '#fff7ed', label: 'LeetCode' },
  hackerrank:          { icon: '🏆', accentColor: '#2ec866', bgTint: '#ecfdf5', label: 'HackerRank' },
  medium:              { icon: '📝', accentColor: '#000000', bgTint: '#f5f5f5', label: 'Medium' },
  'dev.to':            { icon: '🧑‍💻', accentColor: '#3b49df', bgTint: '#eef2ff', label: 'Dev.to' },
  freecodecamp:        { icon: '🔥', accentColor: '#006400', bgTint: '#f0fdf4', label: 'freeCodeCamp' },
  'stack overflow':    { icon: '📋', accentColor: '#f48024', bgTint: '#fff7ed', label: 'Stack Overflow' },
  'official docs':     { icon: '📄', accentColor: '#0369a1', bgTint: '#e0f2fe', label: 'Official Docs' },
  mdn:                 { icon: '🌐', accentColor: '#83d0f2', bgTint: '#e0f7fa', label: 'MDN' },
  github:              { icon: '🐙', accentColor: '#24292e', bgTint: '#f6f8fa', label: 'GitHub' },
  'aws training':      { icon: '☁️', accentColor: '#ff9900', bgTint: '#fff8e1', label: 'AWS Training' },
  'google cloud':      { icon: '🌩️', accentColor: '#4285f4', bgTint: '#e8f0fe', label: 'Google Cloud' },
  pluralsight:         { icon: '📐', accentColor: '#e80a89', bgTint: '#fce7f3', label: 'Pluralsight' },
  'linkedin learning': { icon: '💼', accentColor: '#0a66c2', bgTint: '#e0f2fe', label: 'LinkedIn Learning' },
  codecademy:          { icon: '⌨️', accentColor: '#1f4056', bgTint: '#e0f2fe', label: 'Codecademy' },
  edx:                 { icon: '🏛️', accentColor: '#02262b', bgTint: '#e0f2fe', label: 'edX' },
  kaggle:              { icon: '📊', accentColor: '#20beff', bgTint: '#e0f7fa', label: 'Kaggle' },
};

const DEFAULT_STYLE: PlatformStyle = {
  icon: '🔗',
  accentColor: '#64748b',
  bgTint: '#f8fafc',
  label: 'Resource',
};

const RESOURCE_TYPE_STYLES: Record<ResourceType, ResourceTypeStyle> = {
  course:        { label: 'Course',        color: '#7c3aed', bg: '#f5f3ff' },
  video:         { label: 'Video',         color: '#dc2626', bg: '#fef2f2' },
  practice:      { label: 'Practice',      color: '#ea580c', bg: '#fff7ed' },
  article:       { label: 'Article',       color: '#0369a1', bg: '#e0f2fe' },
  docs:          { label: 'Docs',          color: '#0d9488', bg: '#f0fdfa' },
  repository:    { label: 'Repository',    color: '#1e293b', bg: '#f1f5f9' },
  certification: { label: 'Certification', color: '#ca8a04', bg: '#fefce8' },
};

export const getPlatformStyle = (platform: string): PlatformStyle =>
  PLATFORM_STYLES[platform.toLowerCase()] ?? DEFAULT_STYLE;

export const getResourceTypeStyle = (type: ResourceType | undefined): ResourceTypeStyle | null =>
  type ? RESOURCE_TYPE_STYLES[type] ?? null : null;
