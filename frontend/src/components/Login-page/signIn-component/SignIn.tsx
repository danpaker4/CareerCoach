import { useState, type FormEvent } from 'react';
import './SignIn.css';
import type { User } from '../../../types/user';
import { ENV } from '../../../config';
import { apiFetch } from '../../../lib/apiClient';
import { readAuthResponse } from '../../../lib/authResponse';
import { setStoredAccessToken } from '../../../lib/authSession';

interface SignInProps {
    onLoginSuccess: (user: User) => void;
}

export const SignIn = ({ onLoginSuccess }: SignInProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const response = await apiFetch(`${ENV.USERS_SERVICE_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await readAuthResponse(response);

            if (response.ok && data.success && data.user && data.accessToken) {
                setStoredAccessToken(data.accessToken);
                onLoginSuccess(data.user);
            } else {
                setError(data.error || 'Invalid email or password');
            }
        } catch {
            setError('Server connection failed');
        }
    };

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
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
            
            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="auth-btn">Log In</button>
        </form>
    );
};
