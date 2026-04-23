import { useState } from 'react';
import './SignIn.css';
import { User } from '../../../App';
import { ENV } from '../../../config';

interface SignInProps {
    onLoginSuccess: (user: User) => void;
}

export default function SignIn({ onLoginSuccess }: SignInProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch(`${ENV.USERS_SERVICE_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                onLoginSuccess(data.user);
            } else {
                setError(data.error || 'Invalid email or password');
            }
        } catch (err) {
            console.error(err);
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
            
            {error && <p style={{color: 'red', fontSize: '0.9rem'}}>{error}</p>}

            <button type="submit" className="auth-btn">Log In</button>
        </form>
    );
}