import { useState } from 'react';
import './SignIn.css';
import { ENV } from '../../../config';

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const loginWithGithub = () => {
        window.location.assign(`https://github.com/login/oauth/authorize?client_id=${ENV.GITHUB_CLIENT_ID}&prompt=consent`)
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2>Welcome Back</h2>
                <p className="auth-subtitle">Log in to continue your career journey</p>
                <button onClick={loginWithGithub}>Login with Github</button>

                <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
                    <div className="input-group">
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="auth-btn">Log In</button>
                </form>
            </div>
        </div>
    );
}