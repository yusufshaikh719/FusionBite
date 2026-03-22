// --- START OF FILE Home.jsx ---
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ChefHat, User, LogOut, Settings } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { ref, onValue, push, set } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import './App.css';

const BACKEND_API_URL = 'http://localhost:8000'; 

export default function Home() {
  const navigate = useNavigate();
  const [suggestedMeal, setSuggestedMeal] = useState(null);
  const [generatingMeal, setGeneratingMeal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [recentMeals, setRecentMeals] = useState([]);
  const [mealSaved, setMealSaved] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return navigate('/login');

    const userProfileRef = ref(database, `users/${user.uid}/profile`);
    const unsubscribeProfile = onValue(userProfileRef, (snapshot) => {
      if (snapshot.exists()) setUserProfile(snapshot.val());
    });

    const mealsRef = ref(database, `users/${user.uid}/meals`);
    const unsubscribeMeals = onValue(mealsRef, (snapshot) => {
        if (snapshot.exists()) {
            const mealsArray = Object.values(snapshot.val()).map(m => ({
                timestamp: m.timestamp || new Date().toISOString(),
                carbs: m.nutrition?.carbs || 0,
                protein: m.nutrition?.protein || 0,
                fat: m.nutrition?.fat || 0
            }));
            setRecentMeals(mealsArray);
        }
    });

    return () => { unsubscribeProfile(); unsubscribeMeals(); };
  }, [navigate]);

  const handleSignOut = async () => {
    await getAuth().signOut();
    navigate('/');
  };

  const generateOptimalMeal = async () => {
    if (!userProfile) return;
    setGeneratingMeal(true);
    setSuggestedMeal(null);
    setMealSaved(false);

    try {
      const payload = {
          user_profile: {
              age: parseInt(userProfile.age) || 0,
              gender: userProfile.gender,
              height: parseFloat(userProfile.height) || 0,
              weight: parseFloat(userProfile.weight) || 0,
              activityLevel: userProfile.activityLevel,
              fastingGlucose: parseFloat(userProfile.fastingGlucose) || 90.0,
              fastingInsulin: parseFloat(userProfile.fastingInsulin) || 5.0,
              hba1c: parseFloat(userProfile.hba1c) || 5.0,
              diet: userProfile.diet,
              allergies: userProfile.allergies || "None",
              medicalConditions: userProfile.medicalConditions || "None"
          },
          recent_meals: recentMeals
      };

      const response = await fetch(`${BACKEND_API_URL}/generate_optimal_meal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Failed to optimize meal");

      const data = await response.json();
      setSuggestedMeal({
          name: data.recipe.name,
          ingredients: data.recipe.ingredients,
          directions: data.recipe.directions,
          nutrition: data.recipe.nutrition,
          timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error:', error);
    } finally {
      setGeneratingMeal(false);
    }
  };

  const saveMealToDatabase = async () => {
    const user = getAuth().currentUser;
    if (!user || !suggestedMeal) return;
    try {
      await set(push(ref(database, `users/${user.uid}/meals`)), suggestedMeal);
      setMealSaved(true);
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="flex-row justify-between" style={{ padding: '20px 30px' }}>
        <h1 className="header-text" style={{ fontSize: '2rem', margin: 0 }}>FusionBite</h1>
        <div style={{ position: 'relative' }}>
          <button className="btn-ghost" onClick={() => setShowDropdown(!showDropdown)}>
            <User size={28} />
          </button>
          
          {showDropdown && (
            <div className="card" style={{ position: 'absolute', right: 0, top: '50px', zIndex: 10, padding: 0, width: '200px', overflow: 'hidden' }}>
              <button className="btn-ghost flex-row" style={{ width: '100%', justifyContent: 'flex-start', padding: '15px' }} onClick={() => navigate('/biometricinfo')}>
                <Settings size={20} /> <span style={{ marginLeft: '10px' }}>Twin Settings</span>
              </button>
              <div style={{ borderTop: '1px solid var(--border-color)' }}></div>
              <button className="btn-ghost flex-row" style={{ width: '100%', justifyContent: 'flex-start', padding: '15px', color: 'var(--error-red)' }} onClick={handleSignOut}>
                <LogOut size={20} /> <span style={{ marginLeft: '10px' }}>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="scroll-container" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {/* Digital Twin Optimizer Section */}
        <h2 className="title" style={{ textAlign: 'left' }}>Digital Twin Optimizer</h2>
        <div className="card">
          {suggestedMeal ? (
            <div className="flex-col">
              <div style={{ alignSelf: 'flex-start', background: 'var(--accent-green)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', gap: '5px', alignItems: 'center' }}>
                <Activity size={16} /> Metabolically Optimized
              </div>
              <h3 style={{ color: 'var(--accent-gold)', fontSize: '1.5rem', marginTop: '15px' }}>{suggestedMeal.name}</h3>
              
              <h4 className="subtitle">Optimized Macros:</h4>
              <div className="flex-row" style={{ gap: '15px', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                <span>C: {suggestedMeal.nutrition.carbs}g</span>
                <span>P: {suggestedMeal.nutrition.protein}g</span>
                <span>F: {suggestedMeal.nutrition.fat}g</span>
              </div>

              <h4 className="subtitle" style={{ marginTop: '20px' }}>Ingredients:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                {suggestedMeal.ingredients.map((ing, idx) => (
                  <li key={idx}>{ing.amount}{ing.unit} {ing.item}</li>
                ))}
              </ul>

              <h4 className="subtitle" style={{ marginTop: '20px' }}>Directions:</h4>
              <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                {suggestedMeal.directions.map((dir, idx) => (
                  <li key={idx}>{dir}</li>
                ))}
              </ol>
              
              <div className="flex-row" style={{ gap: '15px', marginTop: '30px' }}>
                <button className="btn" onClick={generateOptimalMeal} disabled={generatingMeal}>
                  <ChefHat size={20} /> {generatingMeal ? 'Solving ODE...' : 'Regenerate'}
                </button>
                <button className="btn btn-gold" onClick={saveMealToDatabase} disabled={mealSaved} style={{ opacity: mealSaved ? 0.7 : 1 }}>
                  {mealSaved ? 'Logged!' : 'Log Meal'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-col" style={{ gap: '20px' }}>
              <p style={{ margin: 0, lineHeight: '1.5' }}>
                Simulate your current biochemical state-space to generate a meal that flattens your glucose curve.
              </p>
              <button className="btn" onClick={generateOptimalMeal} disabled={generatingMeal}>
                <Activity size={24} /> {generatingMeal ? 'Simulating Metabolism...' : 'Optimize Next Meal'}
              </button>
            </div>
          )}
        </div>

        <button className="btn" style={{ marginTop: '20px' }} onClick={() => navigate("/mealmanagement")}>
          View / Log Manual Meals
        </button>
        <button className="btn" style={{ marginTop: '20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--accent-gold)' }} onClick={() => navigate("/mealplanner")}>
          Meal Planner
        </button>
      </div>
    </div>
  );
}
// --- END OF FILE Home.jsx ---