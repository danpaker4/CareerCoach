import { useState } from 'react';
import './SignUp.css';
import { User } from '../../../App';

interface SignUpProps {
    onLoginSuccess: (user: User) => void;
}

export default function SignUp({ onLoginSuccess }: SignUpProps) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [birthDate, setBirthDate] = useState(''); // חובה לשרת
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            // שליחה לשרת המקומי שלך
            const response = await fetch('http://127.0.0.1:3000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    firstName, 
                    lastName, 
                    email, 
                    password,
                    birthDate // הוספנו חזרה כי השרת דורש את זה
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // הרשמה הצליחה - מעדכנים את האפליקציה
                onLoginSuccess({
                    id: data.userId,
                    firstName,
                    lastName,
                    email
                });
            } else {
                setError(data.error || 'Registration failed');
            }
        } catch (err) {
            console.error(err);
            setError('Server connection failed. Is the backend running?');
        }
    };

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-row" style={{display: 'flex', gap: '10px'}}>
                <div className="input-group">
                    <label>First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="input-group">
                    <label>Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
            </div>

            <div className="input-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="input-group">
                <label>Date of Birth</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
            </div>

            <div className="input-group">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && <p style={{color: 'red', fontSize: '0.9rem'}}>{error}</p>}
            
            <button type="submit" className="auth-btn">Create Account</button>
        </form>
    );
}