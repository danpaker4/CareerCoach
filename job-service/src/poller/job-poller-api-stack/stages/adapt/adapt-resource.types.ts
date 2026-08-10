export type AdaptedJob = {
  id: string;
  jobTitle: string;
  url: string;
  company: string;
  seniority: string;
  description: string;
  location?: string;
  lon: number | null;
  lat: number | null;
};
