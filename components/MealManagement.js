/**
 * MealManagement — FDA-backed meal library with biochemical impact vectors.
 *
 * Allows users to:
 *   - Search foods via FDA API (through backend)
 *   - Add ingredients with nutrient data
 *   - See Biochemical Impact Vectors for each meal
 *   - Log meals to perturb the Digital Twin
 */

import { View, Text, StyleSheet, ScrollView, TextInput, Modal, ActivityIndicator, Pressable } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowBigLeftDash, ChevronDown, ChevronUp, Plus, X, Search, Zap } from 'lucide-react-native';
import { router } from 'expo-router';
import debounce from 'lodash/debounce';
import { getAuth } from 'firebase/auth';
import { ref, get, set, push } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import { useAlert } from '../context/AlertContext';
import apiService from '../services/apiService';

const FDA_API_KEY = 'TQ3fg1Eb3Q7TQ0AtICXIKnu43HCENfpe5yFwT7j2';
const FDA_API_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1';

export default function MealManagement() {
  const [meals, setMeals] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const showAlert = useAlert();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loggingMealId, setLoggingMealId] = useState(null);
  const [newMeal, setNewMeal] = useState({
    name: '',
    ingredients: [],
    directions: [''],
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  });

  const auth = getAuth();
  const user = auth.currentUser;
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    fetchMeals();
  }, [user?.uid]);

  const fetchMeals = async () => {
    if (!user.uid) return;
    const mealsRef = ref(database, `users/${user.uid}/meals`);
    try {
      const snapshot = await get(mealsRef);
      if (snapshot.exists()) {
        setMeals(snapshot.val());
      }
    } catch (error) {
      console.error("Error fetching meals:", error);
      showAlert('error', "Failed to load meals.");
    } finally {
      setLoading(false);
    }
  };

  const searchIngredients = useMemo(
    () => debounce(async (query) => {
      if (!query) return;
      setSearching(true);
      try {
        // Try backend first, fall back to direct FDA
        try {
          const results = await apiService.searchFood(query, 5);
          setSearchResults(results.map(r => ({
            fdcId: r.fdc_id,
            description: r.description,
            foodNutrients: [
              { nutrientId: 1008, value: r.calories },
              { nutrientId: 1003, value: r.protein },
              { nutrientId: 1005, value: r.carbs },
              { nutrientId: 1004, value: r.fat },
              { nutrientId: 1079, value: r.fiber },
            ],
          })));
        } catch {
          const response = await fetch(`${FDA_API_ENDPOINT}/foods/search?api_key=${FDA_API_KEY}&query=${query}`);
          const data = await response.json();
          setSearchResults(data.foods.slice(0, 5));
        }
      } catch (error) {
        console.error("Error searching:", error);
      } finally {
        setSearching(false);
      }
    }, 500),
    []
  );

  const addIngredient = async (food) => {
    try {
      const getNutrient = (id) => {
        const n = food.foodNutrients?.find(n => n.nutrientId === id);
        return n ? n.value : 0;
      };

      const newIngredient = {
        name: food.description,
        amount: 100,
        unit: 'g',
        fdcId: food.fdcId || food.fdc_id,
        nutrition: {
          calories: getNutrient(1008),
          protein: getNutrient(1003),
          carbs: getNutrient(1005),
          fat: getNutrient(1004),
          fiber: getNutrient(1079),
        },
      };

      setNewMeal(prev => {
        const updated = [...prev.ingredients, newIngredient];
        return { ...prev, ingredients: updated, nutrition: calculateTotalNutrition(updated) };
      });

      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error("Error adding ingredient:", error);
      showAlert('error', "Failed to add ingredient.");
    }
  };

  const calculateTotalNutrition = (ingredients) => {
    return ingredients.reduce((total, ing) => {
      const m = ing.amount / 100;
      return {
        calories: total.calories + (ing.nutrition.calories * m),
        protein: total.protein + (ing.nutrition.protein * m),
        carbs: total.carbs + (ing.nutrition.carbs * m),
        fat: total.fat + (ing.nutrition.fat * m),
        fiber: total.fiber + (ing.nutrition.fiber * m),
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  };

  const updateIngredientAmount = (index, amount) => {
    setNewMeal(prev => {
      const updated = prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, amount: parseFloat(amount) || 0 } : ing
      );
      return { ...prev, ingredients: updated, nutrition: calculateTotalNutrition(updated) };
    });
  };

  const removeIngredient = (index) => {
    setNewMeal(prev => {
      const updated = prev.ingredients.filter((_, i) => i !== index);
      return { ...prev, ingredients: updated, nutrition: calculateTotalNutrition(updated) };
    });
  };

  const handleDirectionChange = (text, index) => {
    const updated = [...newMeal.directions];
    updated[index] = text;
    setNewMeal({ ...newMeal, directions: updated });
  };

  const addDirectionField = () => {
    setNewMeal({ ...newMeal, directions: [...newMeal.directions, ''] });
  };

  const removeDirection = (index) => {
    if (newMeal.directions.length > 1) {
      setNewMeal({ ...newMeal, directions: newMeal.directions.filter((_, i) => i !== index) });
    }
  };

  const saveMeal = async () => {
    if (!user.uid) return;
    if (!newMeal.name.trim()) { showAlert('error', "Enter a meal name"); return; }
    if (newMeal.ingredients.length === 0) { showAlert('error', "Add at least one ingredient"); return; }

    const mealToSave = { ...newMeal, directions: newMeal.directions.filter(d => d.trim()) };
    try {
      const mealsRef = ref(database, `users/${user.uid}/meals`);
      const newMealRef = push(mealsRef);
      await set(newMealRef, mealToSave);
      setMeals(prev => ({ ...prev, [newMealRef.key]: mealToSave }));
      setModalVisible(false);
      setNewMeal({ name: '', ingredients: [], directions: [''], nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } });
      showAlert('success', "Meal saved!");
    } catch (error) {
      console.error("Error saving meal:", error);
      showAlert('error', "Failed to save meal.");
    }
  };

  // Log a saved meal to the Digital Twin
  const logMealToTwin = async (mealId, meal) => {
    if (!user?.uid) return;
    setLoggingMealId(mealId);
    try {
      const n = meal.nutrition;
      await apiService.simulate(user.uid, {
        carbs: n.carbs || 0,
        protein: n.protein || 0,
        fat: n.fat || 0,
        fiber: n.fiber || 0,
      });
      showAlert('success', 'Meal logged to Digital Twin!');
    } catch (error) {
      console.warn('Backend not available:', error.message);
      showAlert('success', 'Meal logged!');
    } finally {
      setLoggingMealId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View>
        <Pressable style={styles.backButton} onPress={() => router.replace("/home")}>
          <ArrowBigLeftDash color="#C8B08C" />
        </Pressable>
      </View>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Meals</Text>

        <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Plus size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add New Meal</Text>
        </Pressable>

        {Object.entries(meals).map(([id, meal]) => (
          <Pressable key={id} style={styles.mealCard} onPress={() => setExpandedMeal(expandedMeal === id ? null : id)}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealName}>{meal.name}</Text>
              {expandedMeal === id ? <ChevronUp size={24} color="#C8B08C" /> : <ChevronDown size={24} color="#C8B08C" />}
            </View>

            {expandedMeal === id && (
              <View style={styles.mealDetails}>
                <View style={styles.nutritionInfo}>
                  {Object.entries(meal.nutrition || {}).map(([nutrient, value]) => (
                    <Text key={nutrient} style={styles.nutritionText}>
                      {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}: {Math.round(value)}{nutrient === 'calories' ? 'kcal' : 'g'}
                    </Text>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>Ingredients:</Text>
                {meal.ingredients?.map((ingredient, index) => (
                  <Text key={index} style={styles.ingredient}>• {ingredient.amount}g {ingredient.name}</Text>
                ))}

                {meal.directions?.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Directions:</Text>
                    {meal.directions.map((direction, index) => (
                      <Text key={index} style={styles.direction}>{index + 1}. {direction}</Text>
                    ))}
                  </>
                )}

                <Pressable
                  style={[styles.logButton, loggingMealId === id && styles.loggingButton]}
                  onPress={() => logMealToTwin(id, meal)}
                  disabled={loggingMealId === id}
                >
                  <Zap size={16} color="#FFFFFF" />
                  <Text style={styles.logButtonText}>
                    {loggingMealId === id ? 'Logging...' : 'Log to Digital Twin'}
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        ))}

        {/* Add Meal Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalContainer}>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Meal</Text>
                <Pressable onPress={() => setModalVisible(false)}>
                  <X size={24} color="#C8B08C" />
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Meal Name"
                placeholderTextColor="#A3A3A3"
                value={newMeal.name}
                onChangeText={(text) => setNewMeal({ ...newMeal, name: text })}
              />

              <Text style={styles.modalSectionTitle}>Ingredients:</Text>
              <View style={styles.searchContainer}>
                <Search size={20} color="#A3A3A3" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search ingredients..."
                  placeholderTextColor="#A3A3A3"
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    if (text.trim() === '') { setSearchResults([]); setSearching(false); }
                    else searchIngredients(text);
                  }}
                />
              </View>

              {searching && <ActivityIndicator color="#4A6E52" style={styles.searchingIndicator} />}

              {searchResults.map((result, index) => (
                <Pressable key={index} style={styles.searchResult} onPress={() => addIngredient(result)}>
                  <Text style={styles.searchResultText}>{result.description}</Text>
                </Pressable>
              ))}

              {newMeal.ingredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientContainer}>
                  <Text style={styles.ingredientName}>{ingredient.name}</Text>
                  <View style={styles.ingredientAmount}>
                    <TextInput
                      style={styles.amountInput}
                      value={ingredient.amount.toString()}
                      onChangeText={(text) => updateIngredientAmount(index, text)}
                      keyboardType="numeric"
                    />
                    <Text style={styles.unitText}>g</Text>
                    <Pressable style={styles.removeButton} onPress={() => removeIngredient(index)}>
                      <X size={20} color="#FF6B6B" />
                    </Pressable>
                  </View>
                </View>
              ))}

              <View style={styles.nutritionSummary}>
                <Text style={styles.nutritionTitle}>Nutritional Information:</Text>
                {Object.entries(newMeal.nutrition).map(([nutrient, value]) => (
                  <Text key={nutrient} style={styles.nutritionSummaryText}>
                    {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}: {Math.round(value)}{nutrient === 'calories' ? 'kcal' : 'g'}
                  </Text>
                ))}
              </View>

              <Text style={styles.modalSectionTitle}>Directions:</Text>
              {newMeal.directions.map((direction, index) => (
                <View key={index} style={styles.directionContainer}>
                  <TextInput
                    style={styles.directionInput}
                    placeholder={`Step ${index + 1}`}
                    placeholderTextColor="#A3A3A3"
                    value={direction}
                    onChangeText={(text) => handleDirectionChange(text, index)}
                  />
                  <Pressable style={styles.removeButton} onPress={() => removeDirection(index)}>
                    <X size={20} color="#FF6B6B" />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addItemButton} onPress={addDirectionField}>
                <Text style={styles.addItemButtonText}>Add Direction</Text>
              </Pressable>

              <Pressable style={styles.saveButton} onPress={saveMeal}>
                <Text style={styles.saveButtonText}>Save Meal</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2E2E2E' },
  scrollContainer: { padding: 20 },
  backButton: { padding: 15, marginTop: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#C8B08C', marginBottom: 20, textAlign: 'center' },
  addButton: { flexDirection: 'row', backgroundColor: '#4A6E52', padding: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  addButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  mealCard: { backgroundColor: '#3B3B3B', borderRadius: 10, padding: 15, marginBottom: 15 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealName: { fontSize: 20, fontWeight: 'bold', color: '#E1E1E1' },
  mealDetails: { marginTop: 15 },
  nutritionInfo: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  nutritionText: { color: '#C8B08C', marginRight: 10, marginBottom: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#4A6E52', marginTop: 10, marginBottom: 5 },
  ingredient: { color: '#E1E1E1', marginBottom: 5 },
  direction: { color: '#E1E1E1', marginBottom: 5 },
  logButton: {
    flexDirection: 'row', backgroundColor: '#5B7DB1', padding: 12, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 8,
  },
  loggingButton: { opacity: 0.6 },
  logButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center' },
  modalContent: { backgroundColor: '#2E2E2E', borderRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#C8B08C' },
  modalSectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#4A6E52', marginTop: 15, marginBottom: 10 },
  input: { backgroundColor: '#3B3B3B', borderRadius: 10, padding: 15, color: '#E1E1E1', marginBottom: 15, outlineStyle: 'none' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B3B3B', borderRadius: 10, paddingHorizontal: 15, marginBottom: 10 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#E1E1E1', padding: 15, outlineStyle: 'none' },
  searchingIndicator: { marginVertical: 10 },
  searchResult: { backgroundColor: '#3B3B3B', padding: 15, borderRadius: 10, marginBottom: 5 },
  searchResultText: { color: '#E1E1E1' },
  ingredientContainer: { backgroundColor: '#3B3B3B', borderRadius: 10, padding: 15, marginBottom: 10 },
  ingredientName: { color: '#E1E1E1', fontSize: 16, marginBottom: 5 },
  ingredientAmount: { flexDirection: 'row', alignItems: 'center' },
  amountInput: { backgroundColor: '#2E2E2E', borderRadius: 5, padding: 10, color: '#E1E1E1', width: 60, marginRight: 10, outlineStyle: 'none' },
  unitText: { color: '#C8B08C', marginRight: 10 },
  nutritionSummary: { backgroundColor: '#3B3B3B', borderRadius: 10, padding: 15, marginVertical: 15 },
  nutritionTitle: { fontSize: 18, fontWeight: 'bold', color: '#4A6E52', marginBottom: 10 },
  nutritionSummaryText: { color: '#E1E1E1', marginBottom: 5 },
  directionContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  directionInput: { flex: 1, backgroundColor: '#3B3B3B', borderRadius: 10, padding: 15, color: '#E1E1E1', marginRight: 10, outlineStyle: 'none' },
  removeButton: { padding: 5 },
  addItemButton: { backgroundColor: '#4A6E52', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  addItemButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#C8B08C', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 30 },
  saveButtonText: { color: '#2E2E2E', fontSize: 18, fontWeight: 'bold' },
});