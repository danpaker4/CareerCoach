import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Header from './components/header/Header';
import Home from './components/home-page/Home';
import LoginPage from './components/Login-page/Login-page'; // השינוי הגדול: משתמשים בעמוד הראשי
import CareerRoadmap from './components/career-roadmap/CareerRoadmap';

// הגדרת טיפוס המשתמש (כדי שיהיה מסודר)
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentJob?: string;
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // פונקציה שתקרא כשהמשתמש מתחבר (מה-Login Page)
  const handleLoginSuccess = (user: User) => {
    console.log("App: User logged in:", user);
    setCurrentUser(user);
  };

  return (
    <Router>
      <div className="App">

        <Header /> 
        
        <Routes>
          <Route path="/" element={<Home />} />

          <Route 
            path="/login" 
            element={
              currentUser ? <Navigate to="/roadmap" /> : <LoginPage onLoginSuccess={handleLoginSuccess} />
            } 
          />
          
          <Route 
            path="/roadmap" 
            element={<CareerRoadmap user={currentUser || undefined} />} 
          />
          
          <Route path="/signup" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;