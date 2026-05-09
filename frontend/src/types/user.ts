export interface Achievement {
  id: string;
  name: string;
  grade: number;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  birthDate?: string;
  currentJob?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  skills?: string[];
  cv?: string;
  achievements?: Achievement[];
  githubId?: number;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  company?: string;
}
