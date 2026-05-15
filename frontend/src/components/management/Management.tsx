import { Link } from 'react-router-dom';
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
          <h2>Generate content &amp; Live API</h2>
          <p>Monitor model token usage, request volume, averages, and source operations.</p>
          <span className="management-home-card-action">Open analytics</span>
        </Link>

        <Link to="/management/users" className="management-home-card">
          <span className="management-eyebrow">Accounts</span>
          <h2>Users</h2>
          <p>Search users, page through accounts, update roles, and delete accounts.</p>
          <span className="management-home-card-action">Open users</span>
        </Link>
      </div>
    </section>
  </main>
);
