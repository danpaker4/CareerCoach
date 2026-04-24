import { useState } from 'react';
import './SignUp.css';
import { User } from '../../../App';
import { ENV } from '../../../config';

interface SignUpProps {
    onLoginSuccess: (user: User) => void;
}

export default function SignUp({ onLoginSuccess }: SignUpProps) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [currentJob, setCurrentJob] = useState('');
    const [linkedInUrl, setLinkedInUrl] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!cvFile) {
            setError('CV PDF file is required');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('firstName', firstName);
            formData.append('lastName', lastName);
            formData.append('email', email);
            formData.append('password', password);
            formData.append('birthDate', birthDate);
            formData.append('currentJob', currentJob);
            formData.append('linkedInUrl', linkedInUrl);
            formData.append('githubUrl', githubUrl);
            formData.append('cv', cvFile);

            const response = await fetch(`${ENV.USERS_SERVICE_BASE_URL}/api/auth/register`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok && data.success) {
                onLoginSuccess(data.user);
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
                <label>Current Job</label>
                <input type="text" value={currentJob} onChange={(e) => setCurrentJob(e.target.value)} />
            </div>

            <div className="input-group">
                <label>LinkedIn URL</label>
                <input type="url" value={linkedInUrl} onChange={(e) => setLinkedInUrl(e.target.value)} />
            </div>

            <div className="input-group">
                <label>GitHub URL</label>
                <input type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
            </div>

            <div className="input-group">
                <label>CV (PDF)</label>
                <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                    required
                />
                {cvFile && <p style={{ marginTop: '6px', fontSize: '0.85rem' }}>Selected: {cvFile.name}</p>}
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