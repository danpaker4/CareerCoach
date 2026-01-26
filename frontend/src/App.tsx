import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/header/Header';
import Home from './components/home-page/Home';
import SignIn from './components/Login-page/signIn-component/SignIn';
import SignUp from './components/Login-page/signUp-component/SignUp';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        {/* ה-Header יופיע בכל הדפים */}
        <Header />
        
        {/* כאן התוכן מתחלף לפי הכתובת */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;