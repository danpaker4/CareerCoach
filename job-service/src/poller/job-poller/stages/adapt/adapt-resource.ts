import type { AdaptedJob } from "./adapt-resource.types";

export const adaptResource = (resource: any[]): AdaptedJob[] => {
  return resource.map((job: any) => ({
    id: job.id as string,
    jobTitle: job.job_title,
    url: job.final_url as string,
    company: job.company as string,
    seniority: job.seniority as string,
    description: job.description as string,
    lon: job.longitude as number,
    lat: job.latitude as number,
  }));
};
