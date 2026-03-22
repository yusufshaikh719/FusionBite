// --- START OF FILE Login.jsx ---
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import app from '../firebaseConfig';
import { useAlert } from '../app/AlertContext';
import './App.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const showAlert = useAlert();

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) return showAlert('error', "Please fill in all fields");

    setLoading(true);
    const auth = getAuth(app);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/home');
    } catch (error) {
      console.error("Login error:", error);
      showAlert('error', 'An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ justifyContent: 'center', padding: '20px' }}>
      <div className="flex-col" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', gap: '30px' }}>
        <h1 className="header-text">FusionBite</h1>
        
        <form onSubmit={handleLogin} className="flex-col" style={{ gap: '15px' }}>
          <input
            type="email"
            placeholder="Email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '10px' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="flex-row justify-center" style={{ gap: '5px' }}>
          <span>Don't have an account?</span>
          <button className="btn-ghost" onClick={() => navigate("/signup")} style={{ padding: 0 }}>
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}
// --- END OF FILE Login.jsx ---