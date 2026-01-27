import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
    const navigate = useNavigate();

    return (
        <div className="home-content">
            <main className="hero-section">
                <div className="hero-text">
                    <h1>Find Your Dream Job <br /> With CareerCoach</h1>
                    <p>Your personal AI career counselor is here to help you succeed.</p>
                    <button className="cta-button" onClick={() => navigate('/login')}>
                        Get Started
                    </button>
                </div>
            </main>
        </div>
    );
}