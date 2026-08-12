import { ExpandableJobDescription } from '../job-description/ExpandableJobDescription';
import type { ChatJobCardProps } from './chat-job-card.types';

export const ChatJobCard = ({ job, index }: ChatJobCardProps) => {
    return (
        <div className="chat-job-card">
            <span className="chat-job-card__index">{index + 1}</span>
            <div className="chat-job-card__body">
                <div className="chat-job-card__title">{job.title}</div>
                <div className="chat-job-card__company">{job.company}</div>
                <ExpandableJobDescription description={job.description} />
                <div className="chat-job-card__meta">
                    {job.seniority && <span className="chat-job-card__chip">{job.seniority}</span>}
                    {job.location && <span className="chat-job-card__loc">{job.location}</span>}
                    {job.url && (
                        <a
                            className="chat-job-card__link"
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View job
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};
