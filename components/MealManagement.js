import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { ref, get, set, push } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

export default function MealManagement() {
  const [meals, setMeals] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newMeal, setNewMeal] = useState({
    name: '',
    ingredients: [''],
    directions: [''],
    nutrition: {
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      fiber: '',
    },
  });

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    fetchMeals();
  }, [user.uid]);

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
      Alert.alert("Error", "Failed to load meals. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleIngredientChange = (text, index) => {
    const updatedIngredients = [...newMeal.ingredients];
    updatedIngredients[index] = text;
    setNewMeal({ ...newMeal, ingredients: updatedIngredients });
  };

  const handleDirectionChange = (text, index) => {
    const updatedDirections = [...newMeal.directions];
    updatedDirections[index] = text;
    setNewMeal({ ...newMeal, directions: updatedDirections });
  };

  const addIngredientField = () => {
    setNewMeal({
      ...newMeal,
      ingredients: [...newMeal.ingredients, ''],
    });
  };

  const addDirectionField = () => {
    setNewMeal({
      ...newMeal,
      directions: [...newMeal.directions, ''],
    });
  };

  const removeIngredient = (index) => {
    if (newMeal.ingredients.length > 1) {
      const updatedIngredients = newMeal.ingredients.filter((_, i) => i !== index);
      setNewMeal({ ...newMeal, ingredients: updatedIngredients });
    }
  };

  const removeDirection = (index) => {
    if (newMeal.directions.length > 1) {
      const updatedDirections = newMeal.directions.filter((_, i) => i !== index);
      setNewMeal({ ...newMeal, directions: updatedDirections });
    }
  };

  const handleNutritionChange = (nutrient, value) => {
    setNewMeal({
      ...newMeal,
      nutrition: {
        ...newMeal.nutrition,
        [nutrient]: value,
      },
    });
  };

  const saveMeal = async () => {
    if (!user.uid) return;

    // Validate meal data
    if (!newMeal.name.trim()) {
      Alert.alert("Error", "Please enter a meal name");
      return;
    }

    if (newMeal.ingredients.some(i => !i.trim())) {
      Alert.alert("Error", "Please fill in all ingredient fields");
      return;
    }

    if (newMeal.directions.some(d => !d.trim())) {
      Alert.alert("Error", "Please fill in all direction fields");
      return;
    }

    const nutritionValues = Object.entries(newMeal.nutrition).reduce((acc, [key, value]) => {
      acc[key] = value ? parseFloat(value) : 0;
      return acc;
    }, {});

    const mealToSave = {
      ...newMeal,
      nutrition: nutritionValues,
      ingredients: newMeal.ingredients.filter(i => i.trim()),
      directions: newMeal.directions.filter(d => d.trim()),
    };

    try {
      const mealsRef = ref(database, `users/${user.uid}/meals`);
      const newMealRef = push(mealsRef);
      await set(newMealRef, mealToSave);
      
      // Update local state
      setMeals(prevMeals => ({
        ...prevMeals,
        [newMealRef.key]: mealToSave,
      }));
      
      setModalVisible(false);
      setNewMeal({
        name: '',
        ingredients: [''],
        directions: [''],
        nutrition: {
          calories: '',
          protein: '',
          carbs: '',
          fat: '',
          fiber: '',
        },
      });
      Alert.alert("Success", "Meal saved successfully!");
    } catch (error) {
      console.error("Error saving meal:", error);
      Alert.alert("Error", "Failed to save meal. Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A6E52" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>My Meals</Text>
      
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Plus size={24} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Add New Meal</Text>
      </TouchableOpacity>

      {Object.entries(meals).map(([id, meal]) => (
        <TouchableOpacity
          key={id}
          style={styles.mealCard}
          onPress={() => setExpandedMeal(expandedMeal === id ? null : id)}
        >
          <View style={styles.mealHeader}>
            <Text style={styles.mealName}>{meal.name}</Text>
            {expandedMeal === id ? (
              <ChevronUp size={24} color="#C8B08C" />
            ) : (
              <ChevronDown size={24} color="#C8B08C" />
            )}
          </View>
          
          {expandedMeal === id && (
            <View style={styles.mealDetails}>
              <View style={styles.nutritionInfo}>
                {Object.entries(meal.nutrition).map(([nutrient, value]) => (
                  <Text key={nutrient} style={styles.nutritionText}>
                    {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}: 
                    {' '}{Math.round(value)}{nutrient === 'calories' ? 'kcal' : 'g'}
                  </Text>
                ))}
              </View>
              
              <Text style={styles.sectionTitle}>Ingredients:</Text>
              {meal.ingredients.map((ingredient, index) => (
                <Text key={index} style={styles.ingredient}>• {ingredient}</Text>
              ))}
              
              <Text style={styles.sectionTitle}>Directions:</Text>
              {meal.directions.map((direction, index) => (
                <Text key={index} style={styles.direction}>{index + 1}. {direction}</Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
      ))}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Meal</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#C8B08C" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Meal Name"
              placeholderTextColor="#A3A3A3"
              value={newMeal.name}
              onChangeText={(text) => setNewMeal({ ...newMeal, name: text })}
            />

            <Text style={styles.modalSectionTitle}>Nutrition Information:</Text>
            <View style={styles.nutritionInputs}>
              {Object.entries(newMeal.nutrition).map(([nutrient, value]) => (
                <View key={nutrient} style={styles.nutritionInput}>
                  <Text style={styles.nutritionLabel}>
                    {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}:
                  </Text>
                  <TextInput
                    style={styles.nutritionValue}
                    placeholder="0"
                    placeholderTextColor="#A3A3A3"
                    keyboardType="numeric"
                    value={value}
                    onChangeText={(text) => handleNutritionChange(nutrient, text)}
                  />
                </View>
              ))}
            </View>

            <Text style={styles.modalSectionTitle}>Ingredients:</Text>
            {newMeal.ingredients.map((ingredient, index) => (
              <View key={index} style={styles.listItemContainer}>
                <TextInput
                  style={styles.listItemInput}
                  placeholder={`Ingredient ${index + 1}`}
                  placeholderTextColor="#A3A3A3"
                  value={ingredient}
                  onChangeText={(text) => handleIngredientChange(text, index)}
                />
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => removeIngredient(index)}
                >
                  <X size={20} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addItemButton} onPress={addIngredientField}>
              <Text style={styles.addItemButtonText}>Add Ingredient</Text>
            </TouchableOpacity>

            <Text style={styles.modalSectionTitle}>Directions:</Text>
            {newMeal.directions.map((direction, index) => (
              <View key={index} style={styles.listItemContainer}>
                <TextInput
                  style={styles.listItemInput}
                  placeholder={`Step ${index + 1}`}
                  placeholderTextColor="#A3A3A3"
                  value={direction}
                  onChangeText={(text) => handleDirectionChange(text, index)}
                />
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => removeDirection(index)}
                >
                  <X size={20} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addItemButton} onPress={addDirectionField}>
              <Text style={styles.addItemButtonText}>Add Direction</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={saveMeal}>
              <Text style={styles.saveButtonText}>Save Meal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E2E2E',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2E2E2E',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#C8B08C',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 40,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#4A6E52',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  mealCard: {
    backgroundColor: '#3B3B3B',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E1E1E1',
  },
  mealDetails: {
    marginTop: 15,
  },
  nutritionInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  nutritionText: {
    color: '#C8B08C',
    marginRight: 10,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A6E52',
    marginTop: 10,
    marginBottom: 5,
  },
  ingredient: {
    color: '#E1E1E1',
    marginBottom: 5,
  },
  direction: {
    color: '#E1E1E1',
    marginBottom: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#2E2E2E',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#C8B08C',
  },
  input: {
    backgroundColor: '#3B3B3B',
    borderRadius: 10,
    padding: 15,
    color: '#E1E1E1',
    marginBottom: 15,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A6E52',
    marginTop: 15,
    marginBottom: 10,
  },
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  listItemInput: {
    flex: 1,
    backgroundColor: '#3B3B3B',
    borderRadius: 10,
    padding: 15,
    color: '#E1E1E1',
    marginRight: 10,
  },
  removeButton: {
    padding: 5,
  },
});