export interface Achievement {
  id: string;
  name: string;
  grade: number;
}

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  birthDate?: string;
  currentJob?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  githubSkills?: string[];
  knownSkills?: string[];
  /** S3 URI for the uploaded CV PDF. */
  cv?: string;
  /** Extracted plain text from the CV for coaching. */
  cvText?: string;
  achievements?: Achievement[];
  technologies?: string[];
  interests?: string[];
  githubId?: number;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  company?: string;
}
