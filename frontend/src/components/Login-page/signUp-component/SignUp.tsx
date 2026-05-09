import { useState, type FormEvent } from 'react';
import './SignUp.css';
import type { User } from '../../../types/user';
import { ENV } from '../../../config';
import { apiFetch } from '../../../lib/apiClient';
import { readAuthResponse } from '../../../lib/authResponse';
import { setStoredAccessToken } from '../../../lib/authSession';

interface SignUpProps {
    onLoginSuccess: (user: User) => void;
}

export const SignUp = ({ onLoginSuccess }: SignUpProps) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [currentJob, setCurrentJob] = useState('');
    const [linkedInUrl, setLinkedInUrl] = useState('');
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const formData = new FormData();
            formData.append('firstName', firstName);
            formData.append('lastName', lastName);
            formData.append('email', email);
            formData.append('password', password);
            formData.append('birthDate', birthDate);
            formData.append('currentJob', currentJob);
            formData.append('linkedInUrl', linkedInUrl);
            if (cvFile) {
                formData.append('cv', cvFile);
            }

            const response = await apiFetch(`${ENV.USERS_SERVICE_BASE_URL}/api/auth/register`, {
                method: 'POST',
                body: formData,
            });

            const data = await readAuthResponse(response);

            if (response.ok && data.success && data.user && data.accessToken) {
                setStoredAccessToken(data.accessToken);
                onLoginSuccess(data.user);
            } else {
                setError(data.error || 'Registration failed');
            }
        } catch {
            setError('Server connection failed. Is the backend running?');
        }
    };

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-row">
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
                <label>CV (PDF, optional)</label>
                <label className="file-upload" htmlFor="signup-cv">
                    <input
                        id="signup-cv"
                        className="file-upload-input"
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                    />
                    <span className="file-upload-label">{cvFile ? cvFile.name : 'Choose CV file'}</span>
                </label>
            </div>

            <div className="input-group">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && <p className="form-error">{error}</p>}
            
            <button type="submit" className="auth-btn">Create Account</button>
        </form>
    );
};
