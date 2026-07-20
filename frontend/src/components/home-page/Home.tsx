import { useNavigate } from 'react-router-dom';
import iconTarget from '../../assets/icon-target.svg';
import iconZap from '../../assets/icon-zap.svg';
import iconBriefcase from '../../assets/icon-briefcase.svg';
import iconSparkle from '../../assets/icon-sparkle.svg';
import './Home.css';

const FEATURES = [
  {
    icon: iconTarget,
    title: 'Career Roadmap',
    description: 'Set your target role and get a personalized step-by-step path to get there.',
    alt: 'Target icon',
  },
  {
    icon: iconZap,
    title: 'Skill Matcher',
    description: 'See exactly how your current skills align with your dream job requirements.',
    alt: 'Zap icon',
  },
  {
    icon: iconBriefcase,
    title: 'Job Pipeline',
    description: 'Track every application from wishlist to offer in one visual Kanban board.',
    alt: 'Briefcase icon',
  },
  {
    icon: iconSparkle,
    title: 'AI Career Guide',
    description: 'Chat with an AI career advisor trained to help you land your next role faster.',
    alt: 'Sparkle icon',
  },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload your CV', description: 'Start by uploading your current resume. Our AI reads your experience, skills, and background.' },
  { step: '02', title: 'Set your target role', description: 'Tell us where you want to go. Define your dream job title and we\'ll map the gap.' },
  { step: '03', title: 'Follow your roadmap', description: 'Get a clear action plan, track applications, and use the AI guide whenever you need direction.' },
] as const;

export const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-bg-grid" aria-hidden="true" />
        <div className="hero-orb hero-orb--1" aria-hidden="true" />
        <div className="hero-orb hero-orb--2" aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-badge animate-fade-in-up">AI-Powered Career Management</div>
          <h1 className="hero-headline animate-fade-in-up delay-100">
            Land your dream job<br />
            <span className="hero-headline-gradient">with a clear plan</span>
          </h1>
          <p className="hero-sub animate-fade-in-up delay-200">
            CareerCoach gives you a personalized roadmap, skill gap analysis,<br />
            and an AI advisor - all in one place.
          </p>
          <div className="hero-actions animate-fade-in-up delay-300">
            <button type="button" className="btn-hero-primary" onClick={() => navigate('/login')}>
              Get Started Free
            </button>
            <button type="button" className="btn-hero-ghost" onClick={() => { document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}>
              See How It Works
            </button>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="section-inner">
          <div className="section-label">What You Get</div>
          <h2 className="section-title">Everything you need to grow your career</h2>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon-wrap">
                  <img src={f.icon} alt={f.alt} className="feature-icon" />
                </div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-inner">
          <div className="section-label">Simple Process</div>
          <h2 className="section-title">From upload to offer in three steps</h2>
          <div className="how-grid">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="how-card">
                <div className="how-step-num">{item.step}</div>
                <h3 className="how-title">{item.title}</h3>
                <p className="how-desc">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="section-inner">
          <div className="cta-card">
            <h2 className="cta-title">Ready to take control of your career?</h2>
            <p className="cta-sub">Join your teammates and start building your personalized career roadmap today.</p>
            <button type="button" className="btn-hero-primary" onClick={() => navigate('/login')}>
              Create Your Account
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
