import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertProvider } from './app/AlertContext';
import Home from './components/Home';
import Login from './components/Login';
import SignUp from './components/SignUp';
import BiometricInfo from './components/BiometricInfo';
import MealPlanner from './components/MealPlanner';
import MealManagement from './components/MealManagement';

function App() {
  return (
    <AlertProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/home" element={<Home />} />
          <Route path="/biometricinfo" element={<BiometricInfo />} />
          <Route path="/mealplanner" element={<MealPlanner />} />
          <Route path="/mealmanagement" element={<MealManagement />} />
        </Routes>
      </Router>
    </AlertProvider>
  );
}

export default App;
