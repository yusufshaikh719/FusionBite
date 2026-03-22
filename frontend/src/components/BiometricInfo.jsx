// --- START OF FILE BiometricInfo.jsx ---
import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { getAuth } from "firebase/auth";
import { ref, set, get } from "firebase/database";
import app, { database } from "../firebaseConfig";
import { useAlert } from '../app/AlertContext';
import '../App.css';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const ACTIVITY_OPTIONS = ['Sedentary', 'Light', 'Moderate', 'Very Active'];
const DIET_OPTIONS = ['Balanced', 'Low Carb', 'Keto', 'Vegan', 'Vegetarian', 'Paleo'];
const TIMEZONE_OPTIONS = Intl.supportedValuesOf('timeZone');

export default function BiometricInfo() {
  const [loading, setLoading] = useState(false);
  const showAlert = useAlert();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    age: '', gender: '', height: '', weight: '', activityLevel: '',
    diet: '', allergies: '', medicalConditions: '',
    fastingGlucose: '', fastingInsulin: '', hba1c: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const auth = getAuth(app);
  const user = auth?.currentUser;

  useEffect(() => {
    if (user) fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    const userProfileRef = ref(database, `users/${user.uid}/profile`);
    const snapshot = await get(userProfileRef);
    if (snapshot.exists()) setFormData(prev => ({ ...prev, ...snapshot.val() }));
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return showAlert('error', "User not found.");
    setLoading(true);

    try {
      // Save to Firebase
      await set(ref(database, `users/${user.uid}/profile`), formData);

      // Calibrate Twin via Python Backend (Note: localhost is accessed directly on the web)
      const backendUrl = "http://localhost:8000/calibrate_metabolism";
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...formData,
            age: parseInt(formData.age) || 0,
            height: parseFloat(formData.height) || 0,
            weight: parseFloat(formData.weight) || 0,
            fastingGlucose: parseFloat(formData.fastingGlucose) || 90.0,
            fastingInsulin: parseFloat(formData.fastingInsulin) || 5.0,
            hba1c: parseFloat(formData.hba1c) || 5.0,
        })
      });

      if (!response.ok) throw new Error("Metabolic calibration failed");

      showAlert('success', "Digital Twin calibrated!");
      navigate('/home');
    } catch (error) {
      console.error(error);
      showAlert('error', "Failed to calibrate Digital Twin.");
    } finally {
      setLoading(false);
    }
  }

  const formFields = [
    { key: 'age', label: 'Age', type: 'number', placeholder: 'e.g., 25' },
    { key: 'gender', label: 'Gender', type: 'select', options: GENDER_OPTIONS },
    { key: 'height', label: 'Height (cm)', type: 'number', placeholder: 'e.g., 170' },
    { key: 'weight', label: 'Weight (kg)', type: 'number', placeholder: 'e.g., 70' },
    { key: 'activityLevel', label: 'Activity Level', type: 'select', options: ACTIVITY_OPTIONS },
    { key: 'diet', label: 'Dietary Preference', type: 'select', options: DIET_OPTIONS },
    { key: 'allergies', label: 'Allergies', type: 'text', placeholder: 'e.g., Peanuts, Dairy (or None)' },
    { key: 'medicalConditions', label: 'Medical Conditions', type: 'text', placeholder: 'e.g., Type 2 Diabetes' },
    { key: 'fastingGlucose', label: 'Fasting Glucose (mg/dL)', type: 'number', placeholder: 'e.g., 90' },
    { key: 'fastingInsulin', label: 'Fasting Insulin (µU/mL)', type: 'number', placeholder: 'e.g., 5' },
    { key: 'hba1c', label: 'HbA1c (%)', type: 'number', placeholder: 'e.g., 5.4', step: "0.1" },
    { key: 'timezone', label: 'Timezone', type: 'select', options: TIMEZONE_OPTIONS },
  ];

  return (
    <div className="container scroll-container">
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        <h1 className="header-text" style={{ marginBottom: '30px' }}>Metabolic Baseline</h1>
        
        <form onSubmit={handleSubmit} className="flex-col" style={{ gap: '20px' }}>
          {formFields.map((field) => (
            <div key={field.key} className="flex-col" style={{ gap: '8px' }}>
              <label style={{ color: 'var(--accent-gold)', fontSize: '1.1rem' }}>{field.label}</label>
              {field.type === 'select' ? (
                <select name={field.key} value={formData[field.key]} onChange={handleInputChange} className="input">
                  <option value="" disabled>Select {field.label}</option>
                  {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type={field.type}
                  name={field.key}
                  step={field.step}
                  placeholder={field.placeholder}
                  className="input"
                  value={formData[field.key]}
                  onChange={handleInputChange}
                />
              )}
            </div>
          ))}
          
          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '20px' }}>
            {loading ? 'Calibrating Twin...' : 'Save & Calibrate'}
          </button>
        </form>
      </div>
    </div>
  );
}
// --- END OF FILE BiometricInfo.jsx ---
