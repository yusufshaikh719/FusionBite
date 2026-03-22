// --- START OF FILE MealManagement.jsx ---
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Plus, X, Search, Clock } from 'lucide-react';
import debounce from 'lodash/debounce';
import { getAuth } from 'firebase/auth';
import { ref, get, set, push } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import { useAlert } from '../app/AlertContext';
import '../App.css';

// Web Environment Variables (Change VITE_ to REACT_APP_ if using Create React App)
const API_KEY = import.meta.env.VITE_FDA_API_KEY;
const API_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1';

export default function MealManagement() {
  const navigate = useNavigate();
  const showAlert = useAlert();
  
  const [meals, setMeals] = useState({});
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [userTimezone, setUserTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // FDA Search State
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newMeal, setNewMeal] = useState({
    name: '',
    timestamp: new Date().toISOString().slice(0, 16), // Format: YYYY-MM-DDThh:mm
    ingredients: [],
    directions: [''],
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  });

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (user?.uid) fetchMeals();
  }, [user]);

  const fetchMeals = async () => {
    const profileSnapshot = await get(ref(database, `users/${user.uid}/profile`));
    if (profileSnapshot.exists()) setUserTimezone(profileSnapshot.val().timezone || userTimezone);

    const snapshot = await get(ref(database, `users/${user.uid}/meals`));
    if (snapshot.exists()) setMeals(snapshot.val());
  };

  // --- FDA API LOGIC ---
  const executeSearch = async (query) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(`${API_ENDPOINT}/foods/search?api_key=${API_KEY}&query=${query}`);
      const data = await response.json();
      setSearchResults(data.foods.slice(0, 5));
    } catch (error) {
      console.error("Error searching ingredients:", error);
    } finally {
      setSearching(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce(executeSearch, 500), []);

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const addIngredient = async (food) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/food/${food.fdcId}?api_key=${API_KEY}`);
      const detailedFood = await response.json();

      const newIngredient = {
        name: food.description,
        amount: 100,
        unit: 'g',
        nutrition: {
          calories: detailedFood.labelNutrients?.calories?.value || 0,
          protein: detailedFood.labelNutrients?.protein?.value || 0,
          carbs: detailedFood.labelNutrients?.carbohydrates?.value || 0,
          fat: detailedFood.labelNutrients?.fat?.value || 0,
          fiber: detailedFood.labelNutrients?.fiber?.value || 0,
        }
      };

      setNewMeal(prev => {
        const updatedIngredients = [...prev.ingredients, newIngredient];
        return {
          ...prev,
          ingredients: updatedIngredients,
          nutrition: calculateTotalNutrition(updatedIngredients)
        };
      });

      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error("Error adding ingredient:", error);
      showAlert('error', "Failed to add ingredient.");
    }
  };

  const calculateTotalNutrition = (ingredients) => {
    return ingredients.reduce((total, ingredient) => {
      const multiplier = ingredient.amount / 100;
      return {
        calories: total.calories + (ingredient.nutrition.calories * multiplier),
        protein: total.protein + (ingredient.nutrition.protein * multiplier),
        carbs: total.carbs + (ingredient.nutrition.carbs * multiplier),
        fat: total.fat + (ingredient.nutrition.fat * multiplier),
        fiber: total.fiber + (ingredient.nutrition.fiber * multiplier),
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  };

  const updateIngredientAmount = (index, amount) => {
    setNewMeal(prev => {
      const updatedIngredients = prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, amount: parseFloat(amount) || 0 } : ing
      );
      return {
        ...prev,
        ingredients: updatedIngredients,
        nutrition: calculateTotalNutrition(updatedIngredients)
      };
    });
  };

  const removeIngredient = (index) => {
    setNewMeal(prev => {
      const updatedIngredients = prev.ingredients.filter((_, i) => i !== index);
      return {
        ...prev,
        ingredients: updatedIngredients,
        nutrition: calculateTotalNutrition(updatedIngredients)
      };
    });
  };

  // --- DIRECTIONS LOGIC ---
  const handleDirectionChange = (text, index) => {
    const updatedDirections = [...newMeal.directions];
    updatedDirections[index] = text;
    setNewMeal({ ...newMeal, directions: updatedDirections });
  };

  const addDirectionField = () => {
    setNewMeal({ ...newMeal, directions: [...newMeal.directions, ''] });
  };

  const removeDirection = (index) => {
    if (newMeal.directions.length > 1) {
      const updatedDirections = newMeal.directions.filter((_, i) => i !== index);
      setNewMeal({ ...newMeal, directions: updatedDirections });
    }
  };

  // --- SAVE TO FIREBASE ---
  const saveMeal = async (e) => {
    e.preventDefault();
    if (!newMeal.name.trim()) return showAlert('error', "Please enter a meal name");
    if (newMeal.ingredients.length === 0) return showAlert('error', "Please add at least one ingredient");

    const mealToSave = {
      ...newMeal,
      // Convert HTML datetime-local string back to standard ISO for the backend math
      timestamp: new Date(newMeal.timestamp).toISOString(), 
      directions: newMeal.directions.filter(d => d.trim()),
    };

    try {
      await set(push(ref(database, `users/${user.uid}/meals`)), mealToSave);
      setModalVisible(false);
      setNewMeal({
        name: '',
        timestamp: new Date().toISOString().slice(0, 16),
        ingredients: [],
        directions: [''],
        nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      });
      showAlert('success', "Meal saved! Digital Twin updated.");
      fetchMeals();
    } catch (error) {
      showAlert('error', "Failed to save meal.");
    }
  };

  return (
    <div className="container scroll-container">
      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        {/* Header */}
        <div className="flex-row" style={{ marginBottom: '30px' }}>
          <button className="btn-ghost" onClick={() => navigate("/home")}>
            <ArrowLeft size={28} />
          </button>
          <h1 className="title" style={{ margin: 0, flex: 1 }}>My Meals (Metabolic Log)</h1>
          <div style={{ width: 28 }} />
        </div>

        <button className="btn" onClick={() => setModalVisible(true)} style={{ marginBottom: '30px' }}>
          <Plus size={24} /> Add New Meal
        </button>

        {/* Saved Meals List */}
        {Object.entries(meals).map(([id, meal]) => (
          <div key={id} className="card" style={{ cursor: 'pointer' }} onClick={() => setExpandedMeal(expandedMeal === id ? null : id)}>
            <div className="flex-row justify-between">
              <div className="flex-col">
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{meal.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>
                  <Clock size={12} style={{ display: 'inline', marginRight: '4px' }}/>
                  {new Date(meal.timestamp).toLocaleString(undefined, { timeZone: userTimezone })} ({userTimezone})
                </span>
              </div>
              {expandedMeal === id ? <ChevronUp color="var(--accent-gold)" /> : <ChevronDown color="var(--accent-gold)" />}
            </div>
            
            {expandedMeal === id && (
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                <div className="flex-row" style={{ gap: '15px', color: 'var(--accent-gold)', flexWrap: 'wrap', marginBottom: '15px' }}>
                  <span>Cal: {Math.round(meal.nutrition?.calories || 0)}</span>
                  <span>C: {Math.round(meal.nutrition?.carbs || 0)}g</span>
                  <span>P: {Math.round(meal.nutrition?.protein || 0)}g</span>
                  <span>F: {Math.round(meal.nutrition?.fat || 0)}g</span>
                </div>
                
                <h4 className="subtitle" style={{ color: 'var(--accent-green)' }}>Ingredients:</h4>
                <ul style={{ paddingLeft: '20px', margin: '5px 0 15px 0' }}>
                  {meal.ingredients?.map((ing, idx) => (
                    <li key={idx} style={{ color: 'var(--text-light)' }}>{ing.amount}g {ing.name}</li>
                  ))}
                </ul>

                <h4 className="subtitle" style={{ color: 'var(--accent-green)' }}>Directions:</h4>
                <ol style={{ paddingLeft: '20px', margin: '5px 0 0 0' }}>
                  {meal.directions?.map((dir, idx) => (
                    <li key={idx} style={{ color: 'var(--text-light)' }}>{dir}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}

        {/* Modal / Overlay for Adding Meal */}
        {modalVisible && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '20px' }}>
            <div className="card scroll-container" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', backgroundColor: 'var(--bg-dark)' }}>
              
              <div className="flex-row justify-between" style={{ marginBottom: '20px' }}>
                <h2 className="title" style={{ margin: 0 }}>Add New Meal</h2>
                <button className="btn-ghost" onClick={() => setModalVisible(false)}><X size={24} /></button>
              </div>

              <form onSubmit={saveMeal} className="flex-col" style={{ gap: '20px' }}>
                
                {/* Basic Info */}
                <input className="input" type="text" placeholder="Meal Name" value={newMeal.name} onChange={e => setNewMeal({...newMeal, name: e.target.value})} required />
                
                <div className="flex-col" style={{ gap: '8px' }}>
                  <label style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>Time Consumed ({userTimezone}):</label>
                  <input className="input" type="datetime-local" value={newMeal.timestamp} onChange={e => setNewMeal({...newMeal, timestamp: e.target.value})} required />
                </div>

                {/* FDA Search */}
                <div className="flex-col" style={{ gap: '8px', marginTop: '10px' }}>
                  <label style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>Ingredients:</label>
                  <div className="input flex-row" style={{ padding: '0 15px', backgroundColor: 'var(--bg-card)' }}>
                    <Search size={20} color="var(--text-muted)" />
                    <input 
                      type="text" 
                      placeholder="Search FDA database..." 
                      style={{ flex: 1, border: 'none', background: 'transparent', color: 'white', padding: '16px', outline: 'none' }}
                      value={searchQuery}
                      onChange={handleSearchChange}
                    />
                  </div>
                </div>

                {searching && <div style={{ color: 'var(--accent-gold)', textAlign: 'center' }}>Searching FDA Database...</div>}

                {searchResults.length > 0 && (
                  <div className="flex-col" style={{ gap: '5px', backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '10px' }}>
                    {searchResults.map((result, idx) => (
                      <div key={idx} onClick={() => addIngredient(result)} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>
                        {result.description}
                      </div>
                    ))}
                  </div>
                )}

                {/* Added Ingredients List */}
                {newMeal.ingredients.map((ingredient, index) => (
                  <div key={index} className="flex-row justify-between card" style={{ padding: '10px 15px', marginBottom: 0 }}>
                    <span style={{ flex: 1 }}>{ingredient.name}</span>
                    <div className="flex-row" style={{ gap: '10px' }}>
                      <input 
                        type="number" 
                        value={ingredient.amount} 
                        onChange={(e) => updateIngredientAmount(index, e.target.value)}
                        className="input" 
                        style={{ width: '80px', padding: '8px' }}
                      />
                      <span style={{ color: 'var(--accent-gold)' }}>g</span>
                      <button type="button" className="btn-ghost" onClick={() => removeIngredient(index)} style={{ color: 'var(--error-red)', padding: '5px' }}>
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Nutrition Summary */}
                <div className="card" style={{ backgroundColor: 'var(--bg-card)', padding: '15px' }}>
                  <h4 style={{ color: 'var(--accent-green)', margin: '0 0 10px 0' }}>Calculated Nutrition:</h4>
                  <div className="flex-row" style={{ gap: '15px', flexWrap: 'wrap' }}>
                    <span>Calories: {Math.round(newMeal.nutrition.calories)}kcal</span>
                    <span>Carbs: {Math.round(newMeal.nutrition.carbs)}g</span>
                    <span>Protein: {Math.round(newMeal.nutrition.protein)}g</span>
                    <span>Fat: {Math.round(newMeal.nutrition.fat)}g</span>
                  </div>
                </div>

                {/* Directions */}
                <div className="flex-col" style={{ gap: '10px' }}>
                  <label style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>Directions:</label>
                  {newMeal.directions.map((direction, index) => (
                    <div key={index} className="flex-row" style={{ gap: '10px' }}>
                      <input 
                        className="input" 
                        placeholder={`Step ${index + 1}`} 
                        value={direction} 
                        onChange={(e) => handleDirectionChange(e.target.value, index)}
                      />
                      <button type="button" className="btn-ghost" onClick={() => removeDirection(index)} style={{ color: 'var(--error-red)' }}>
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn" onClick={addDirectionField} style={{ backgroundColor: 'var(--bg-card)', border: '1px dashed var(--accent-green)' }}>
                    + Add Step
                  </button>
                </div>

                {/* Save */}
                <button type="submit" className="btn btn-gold" style={{ marginTop: '20px' }}>
                  Save Meal
                </button>
              </form>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// --- END OF FILE MealManagement.jsx ---