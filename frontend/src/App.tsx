import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './header/Header'
import Home from './components/home-page/Home'
import LoginPage from './components/Login-page/Login-page'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

