import { ChatInterface } from '../chat-component/Chat';
import type { User } from '../../types/user';
import './ChatPage.css';

const MAX_CV_EXCERPT_CHARS = 4000;

interface ChatPageProps {
  user: User;
}

const QUICK_PROMPTS = [
  'What skills should I learn for my next role?',
  'Review my career progress so far',
  'Suggest jobs that match my profile',
  'How can I improve my CV?',
  'What salary should I expect?',
  'Help me prepare for interviews',
];

export const ChatPage = ({ user }: ChatPageProps) => {
  return (
    <div className="chat-page">

      {/* Sidebar */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div className="chat-coach-avatar">🤖</div>
          <div>
            <p className="chat-coach-name">AI Career Coach</p>
            <p className="chat-coach-status">
              <span className="chat-status-dot" />
              Online
            </p>
          </div>
        </div>
        <div className="chat-quick-prompts">
          <p className="chat-sidebar-label">Quick prompts</p>
          <div className="chat-prompt-list">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="chat-prompt-btn"
                onClick={() => {
                  const textarea = document.querySelector<HTMLTextAreaElement>('.input-area textarea');
                  if (textarea) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                    nativeInputValueSetter?.call(textarea, prompt);
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.focus();
                  }
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="chat-main">
        <div className="chat-main-header">
          <div className="chat-main-title">
            <span className="chat-main-icon">✨</span>
            <div>
              <h1 className="chat-main-heading">AI Career Coach</h1>
              <p className="chat-main-sub">Ask me anything about your career, skills, or job search</p>
            </div>
          </div>
        </div>

        <div className="chat-interface-wrap">
          <ChatInterface
            userId={user.id}
            userProfile={{
              firstName: user.firstName,
              lastName: user.lastName,
              currentJob: user.currentJob,
              achievements: user.achievements,
              technologies: user.technologies,
              interests: user.interests,
              githubSkills: user.githubSkills,
              knownSkills: user.knownSkills,
              cvExcerpt:
                typeof user.cv === 'string' && user.cv.trim().length > 0
                  ? user.cv.trim().slice(0, MAX_CV_EXCERPT_CHARS)
                  : undefined,
            }}
          />
        </div>
      </main>

    </div>
  );
};
