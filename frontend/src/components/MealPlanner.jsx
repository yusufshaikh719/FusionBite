// --- START OF FILE MealPlanner.jsx ---
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { ref, get, set, onValue } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import { useAlert } from '../app/AlertContext';
import '../App.css';

const MEAL_TIMES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export default function MealPlanner() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const showAlert = useAlert();
  const [availableMeals, setAvailableMeals] = useState({});
  const [selectedMeals, setSelectedMeals] = useState({ Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState('');

  const auth = getAuth(app);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user?.uid) return;
    const date = new Date().toISOString().split('T')[0];
    
    onValue(ref(database, `users/${user.uid}/meals`), (snapshot) => {
      if (snapshot.exists()) setAvailableMeals(snapshot.val());
      setLoading(false);
    });

    get(ref(database, `users/${user.uid}/mealPlans/${date}`)).then((snapshot) => {
      if (snapshot.exists()) setSelectedMeals(snapshot.val().meals || { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
    });
  }, [user]);

  const handleAddMeal = (mealTime) => { setCurrentMealTime(mealTime); setModalVisible(true); };
  const handleSelectMeal = (mealId) => {
    setSelectedMeals({ ...selectedMeals, [currentMealTime]: [...(selectedMeals[currentMealTime] || []), mealId] });
    setModalVisible(false);
  };
  const handleRemoveMeal = (mealTime, index) => {
    setSelectedMeals({ ...selectedMeals, [mealTime]: selectedMeals[mealTime].filter((_, i) => i !== index) });
  };

  const saveMealPlan = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      await set(ref(database, `users/${user.uid}/mealPlans/${date}`), { meals: selectedMeals, date });
      showAlert('success', "Meal plan saved!");
    } catch (error) {
      showAlert('error', "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container justify-center" style={{ alignItems: 'center' }}>Loading...</div>;

  return (
    <div className="container scroll-container">
      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div className="flex-row" style={{ marginBottom: '30px' }}>
          <button className="btn-ghost" onClick={() => navigate("/home")}><ArrowLeft size={28} /></button>
          <h1 className="title" style={{ margin: 0, flex: 1 }}>Today's Meal Plan</h1>
          <div style={{ width: 28 }} />
        </div>

        {MEAL_TIMES.map((mealTime) => (
          <div key={mealTime} style={{ marginBottom: '30px' }}>
            <h2 className="subtitle" style={{ color: 'var(--accent-green)', fontSize: '1.4rem' }}>{mealTime}</h2>
            {selectedMeals[mealTime]?.map((mealId, index) => (
              <div key={`${mealTime}-${index}`} className="card flex-row justify-between" style={{ padding: '15px', marginBottom: '10px' }}>
                <span>{availableMeals[mealId]?.name}</span>
                <button className="btn-ghost" onClick={() => handleRemoveMeal(mealTime, index)} style={{ color: 'var(--error-red)' }}>
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            <button className="btn" onClick={() => handleAddMeal(mealTime)} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-light)', border: '1px dashed var(--accent-gold)' }}>
              + Add {mealTime}
            </button>
          </div>
        ))}

        <button className="btn btn-gold" onClick={saveMealPlan} disabled={saving} style={{ marginTop: '20px' }}>
          {saving ? 'Saving...' : 'Save Meal Plan'}
        </button>

        {modalVisible && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
            <div className="card" style={{ width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
              <h2 className="title">Select a meal</h2>
              {Object.entries(availableMeals).map(([id, meal]) => (
                <button key={id} onClick={() => handleSelectMeal(id)} className="btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', borderBottom: '1px solid var(--border-color)', padding: '15px 0' }}>
                  {meal.name}
                </button>
              ))}
              <button className="btn" onClick={() => setModalVisible(false)} style={{ marginTop: '20px', backgroundColor: 'var(--error-red)' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// --- END OF FILE MealPlanner.jsx ---
