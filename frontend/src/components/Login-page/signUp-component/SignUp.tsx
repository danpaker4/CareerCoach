import { useState } from 'react';
import './SignUp.css';

export default function SignUp() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2>Create Account</h2>
                <p className="auth-subtitle">Start building your dream career today</p>
                
                <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
                    <div className="input-group">
                        <label>Full Name</label>
                        <input 
                            type="text" 
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>
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
                    <button type="submit" className="auth-btn">Sign Up</button>
                </form>
            </div>
        </div>
    );
}