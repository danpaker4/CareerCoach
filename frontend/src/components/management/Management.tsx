import { Link } from 'react-router-dom';
import { ENV } from '../../config';
import './Management.css';

export const Management = () => (
  <main className="management-page">
    <section className="management-header">
      <div>
        <p className="management-eyebrow">Admin tools</p>
        <h1>Management</h1>
        <p className="management-subtitle">Choose the management area you want to work with.</p>
      </div>
    </section>

    <section className="management-home" aria-label="Management areas">
      <div className="management-home-grid">
        <Link to="/management/usage" className="management-home-card">
          <span className="management-eyebrow">Analytics</span>
          <h2>Monitor model usage</h2>
          <p>Monitor model token usage, request volume, averages, and source operations.</p>
          <span className="management-home-card-action">Open analytics</span>
        </Link>

        <Link to="/management/users" className="management-home-card">
          <span className="management-eyebrow">Accounts</span>
          <h2>Users</h2>
          <p>Search users, page through accounts, update roles, and delete accounts.</p>
          <span className="management-home-card-action">Open users</span>
        </Link>

        <Link to="/management/benchmarks" className="management-home-card">
          <span className="management-eyebrow">Evaluation</span>
          <h2>Chat LLM benchmark</h2>
          <p>Run randomized chat benchmark samples against Llama/Ollama and Gemini, then compare model metrics.</p>
          <span className="management-home-card-action">Open benchmarks</span>
        </Link>

        <Link to="/management/rate-limits" className="management-home-card">
          <span className="management-eyebrow">Controls</span>
          <h2>Chat rate limits</h2>
          <p>Update live chat request limits, active request locks, and daily token budgets.</p>
          <span className="management-home-card-action">Open limits</span>
        </Link>

        <Link to="/management/llm-evaluation" className="management-home-card">
          <span className="management-eyebrow">Quality</span>
          <h2>LLM evaluation</h2>
          <p>Review model responses, compare runs, and track evaluation metrics over time.</p>
          <span className="management-home-card-action">Open LLM evaluation</span>
        </Link>

        <Link to="/management/promptfoo" className="management-home-card">
          <span className="management-eyebrow">Quality</span>
          <h2>Promptfoo tests</h2>
          <p>View Promptfoo eval results in the embedded local viewer (port 15500).</p>
          <span className="management-home-card-action">Open Promptfoo</span>
        </Link>

        {ENV.LANGFUSE_DASHBOARD_URL && (
          <a
            href={ENV.LANGFUSE_DASHBOARD_URL}
            className="management-home-card"
            target="_blank"
            rel="noreferrer"
          >
            <span className="management-eyebrow">Observability</span>
            <h2>Langfuse traces</h2>
            <p>Inspect AI generations, latency, token usage, errors, and conversation sessions.</p>
            <span className="management-home-card-action">Open Langfuse</span>
          </a>
        )}
      </div>
    </section>
  </main>
);
