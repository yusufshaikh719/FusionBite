import { View, Text, StyleSheet, ScrollView, TextInput, Modal, Alert, ActivityIndicator, Pressable } from 'react-native';
import React, { useState, useEffect } from 'react';
import { ArrowBigLeftDash, ChevronDown, ChevronUp, Plus, X, Search } from 'lucide-react-native';
import { router } from 'expo-router';
import debounce from 'lodash/debounce';
import { getAuth } from 'firebase/auth';
import { ref, get, set, push } from 'firebase/database';
import app, { database } from '../firebaseConfig';

const API_KEY = 'CVHaXZOgoCwg59Hcjd3bnX02fUqKii1MnDfCLKSO';
const API_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1';

export default function MealManagement() {
  const [meals, setMeals] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [newMeal, setNewMeal] = useState({
    name: '',
    ingredients: [],
    directions: [''],
    nutrition: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
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

  const searchIngredients = debounce(async (query) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(
        `${API_ENDPOINT}/foods/search?api_key=${API_KEY}&query=${query}`
      );
      const data = await response.json();
      setSearchResults(data.foods.slice(0, 5));
    } catch (error) {
      console.error("Error searching ingredients:", error);
    } finally {
      setSearching(false);
    }
  }, 500);

  const addIngredient = async (food) => {
    try {
      const response = await fetch(
        `${API_ENDPOINT}/food/${food.fdcId}?api_key=${API_KEY}`
      );
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
        const updatedNutrition = calculateTotalNutrition(updatedIngredients);
        return {
          ...prev,
          ingredients: updatedIngredients,
          nutrition: updatedNutrition
        };
      });

      setSearchResults([]);
    } catch (error) {
      console.error("Error adding ingredient:", error);
      Alert.alert("Error", "Failed to add ingredient. Please try again.");
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
    }, {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });
  };

  const updateIngredientAmount = (index, amount) => {
    setNewMeal(prev => {
      const updatedIngredients = prev.ingredients.map((ing, i) => 
        i === index ? { ...ing, amount: parseFloat(amount) || 0 } : ing
      );
      const updatedNutrition = calculateTotalNutrition(updatedIngredients);
      return {
        ...prev,
        ingredients: updatedIngredients,
        nutrition: updatedNutrition
      };
    });
  };

  const removeIngredient = (index) => {
    setNewMeal(prev => {
      const updatedIngredients = prev.ingredients.filter((_, i) => i !== index);
      const updatedNutrition = calculateTotalNutrition(updatedIngredients);
      return {
        ...prev,
        ingredients: updatedIngredients,
        nutrition: updatedNutrition
      };
    });
  };

  const handleDirectionChange = (text, index) => {
    const updatedDirections = [...newMeal.directions];
    updatedDirections[index] = text;
    setNewMeal({ ...newMeal, directions: updatedDirections });
  };

  const addDirectionField = () => {
    setNewMeal({
      ...newMeal,
      directions: [...newMeal.directions, ''],
    });
  };

  const removeDirection = (index) => {
    if (newMeal.directions.length > 1) {
      const updatedDirections = newMeal.directions.filter((_, i) => i !== index);
      setNewMeal({ ...newMeal, directions: updatedDirections });
    }
  };

  const saveMeal = async () => {
    if (!user.uid) return;

    if (!newMeal.name.trim()) {
      Alert.alert("Error", "Please enter a meal name");
      return;
    }

    if (newMeal.ingredients.length === 0) {
      Alert.alert("Error", "Please add at least one ingredient");
      return;
    }

    if (newMeal.directions.some(d => !d.trim())) {
      Alert.alert("Error", "Please fill in all direction fields");
      return;
    }

    const mealToSave = {
      ...newMeal,
      directions: newMeal.directions.filter(d => d.trim()),
    };

    try {
      const mealsRef = ref(database, `users/${user.uid}/meals`);
      const newMealRef = push(mealsRef);
      await set(newMealRef, mealToSave);
      
      setMeals(prevMeals => ({
        ...prevMeals,
        [newMealRef.key]: mealToSave,
      }));
      
      setModalVisible(false);
      setNewMeal({
        name: '',
        ingredients: [],
        directions: [''],
        nutrition: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
        },
      });
      Alert.alert("Success", "Meal saved successfully!");
    } catch (error) {
      console.error("Error saving meal:", error);
      Alert.alert("Error", "Failed to save meal. Please try again.");
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
        
        <Pressable 
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Plus size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add New Meal</Text>
        </Pressable>

        {Object.entries(meals).map(([id, meal]) => (
          <Pressable
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
                  <Text key={index} style={styles.ingredient}>
                    • {ingredient.amount}g {ingredient.name}
                  </Text>
                ))}
                
                <Text style={styles.sectionTitle}>Directions:</Text>
                {meal.directions.map((direction, index) => (
                  <Text key={index} style={styles.direction}>
                    {index + 1}. {direction}
                  </Text>
                ))}
              </View>
            )}
          </Pressable>
        ))}

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
        >
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
                  onChangeText={searchIngredients}
                />
              </View>

              {searching && (
                <ActivityIndicator color="#4A6E52" style={styles.searchingIndicator} />
              )}

              {searchResults.map((result, index) => (
                <Pressable
                  key={index}
                  style={styles.searchResult}
                  onPress={() => addIngredient(result)}
                >
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
                    <Pressable 
                      style={styles.removeButton}
                      onPress={() => removeIngredient(index)}
                    >
                      <X size={20} color="#FF6B6B" />
                    </Pressable>
                  </View>
                </View>
              ))}

              <View style={styles.nutritionSummary}>
                <Text style={styles.nutritionTitle}>Nutritional Information:</Text>
                {Object.entries(newMeal.nutrition).map(([nutrient, value]) => (
                  <Text key={nutrient} style={styles.nutritionSummaryText}>
                    {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}: 
                    {' '}{Math.round(value)}{nutrient === 'calories' ? 'kcal' : 'g'}
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
                  <Pressable 
                    style={styles.removeButton}
                    onPress={() => removeDirection(index)}
                  >
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
    container: {
      flex: 1,
      backgroundColor: '#2E2E2E',
    },
    scrollContainer: {
      padding: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#2E2E2E',
    },
    backButton: {
      padding: 15,
      marginTop: 40,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#C8B08C',
      marginBottom: 20,
      textAlign: 'center',
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
    modalSectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#4A6E52',
      marginTop: 15,
      marginBottom: 10,
    },
    input: {
      backgroundColor: '#3B3B3B',
      borderRadius: 10,
      padding: 15,
      color: '#E1E1E1',
      marginBottom: 15,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#3B3B3B',
      borderRadius: 10,
      paddingHorizontal: 15,
      marginBottom: 10,
    },
    searchIcon: {
      marginRight: 10,
    },
    searchInput: {
      flex: 1,
      color: '#E1E1E1',
      padding: 15,
    },
    searchingIndicator: {
      marginVertical: 10,
    },
    searchResult: {
      backgroundColor: '#3B3B3B',
      padding: 15,
      borderRadius: 10,
      marginBottom: 5,
    },
    searchResultText: {
      color: '#E1E1E1',
    },
    ingredientContainer: {
      backgroundColor: '#3B3B3B',
      borderRadius: 10,
      padding: 15,
      marginBottom: 10,
    },
    ingredientName: {
      color: '#E1E1E1',
      fontSize: 16,
      marginBottom: 5,
    },
    ingredientAmount: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    amountInput: {
      backgroundColor: '#2E2E2E',
      borderRadius: 5,
      padding: 10,
      color: '#E1E1E1',
      width: 60,
      marginRight: 10,
    },
    unitText: {
      color: '#C8B08C',
      marginRight: 10,
    },
    nutritionSummary: {
      backgroundColor: '#3B3B3B',
      borderRadius: 10,
      padding: 15,
      marginVertical: 15,
    },
    nutritionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#4A6E52',
      marginBottom: 10,
    },
    nutritionSummaryText: {
      color: '#E1E1E1',
      marginBottom: 5,
    },
    directionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    directionInput: {
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
    addItemButton: {
      backgroundColor: '#4A6E52',
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 10,
    },
    addItemButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    saveButton: {
      backgroundColor: '#C8B08C',
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 30,
    },
    saveButtonText: {
      color: '#2E2E2E',
      fontSize: 18,
      fontWeight: 'bold',
    },
  });