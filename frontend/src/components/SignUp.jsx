// --- START OF FILE SignUp.jsx ---
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import app, { database } from "../firebaseConfig";
import { useAlert } from "../app/AlertContext";
import '../App.css';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const showAlert = useAlert();

  async function handleSignUp(e) {
    e.preventDefault();
    if (!email || !password || !username) return showAlert('error', "Please fill in all fields");

    setLoading(true);
    const auth = getAuth(app);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userProfileRef = ref(database, `users/${userCredential.user.uid}/profile`);
      await set(userProfileRef, { username });
      navigate("/biometricinfo");
    } catch (error) {
      console.error("Sign up error:", error);
      showAlert('error', 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ justifyContent: 'center', padding: '20px' }}>
      <div className="flex-col" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', gap: '30px' }}>
        <h1 className="header-text">Sign Up</h1>
        
        <form onSubmit={handleSignUp} className="flex-col" style={{ gap: '15px' }}>
          <input
            type="text"
            placeholder="Username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="text"
            placeholder="Password"
            className="input password-mask"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '10px' }}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
}
// --- END OF FILE SignUp.jsx ---
