import { ChatInterface } from '../chat-component/Chat';
import './Home.css';

interface HomeProps {
    user?: {
        _id: string;
        firstName: string;
        lastName: string;
    };
    onLogout?: () => void;
}

export default function Home({ user, onLogout }: HomeProps) {
    return (
        <div className="home-content">
            <main className="hero-section">
                <div className="hero-text">
                    <h1>Find Your Dream Job <br /> With CareerCoach</h1>
                    <p>Your personal AI career counselor is here to help you succeed.</p>
                </div>
            </main>
            
            
            <ChatInterface 
                userId={user?._id || "guest"} 
                userName={user?.firstName} 
            />
        </div>
    );
}