import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Calendar, ChefHat } from 'lucide-react';
import { ref, onValue, push, set } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import { getAuth } from 'firebase/auth';

const API_KEY = 'CVHaXZOgoCwg59Hcjd3bnX02fUqKii1MnDfCLKSO';
const API_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1';

// Define common ingredients for different diet types
const DIET_INGREDIENTS = {
  omnivore: ['chicken breast', 'salmon', 'beef', 'eggs', 'greek yogurt'],
  vegetarian: ['tofu', 'tempeh', 'eggs', 'greek yogurt', 'quinoa'],
  vegan: ['tofu', 'tempeh', 'quinoa', 'lentils', 'chickpeas'],
  keto: ['chicken breast', 'salmon', 'beef', 'eggs', 'avocado'],
};

const COMMON_VEGGIES = ['broccoli', 'spinach', 'kale', 'cauliflower', 'bell pepper'];
const COMMON_CARBS = ['brown rice', 'sweet potato', 'quinoa', 'oats', 'whole wheat pasta'];

export default function Home() {
  const [nutritionData, setNutritionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suggestedMeal, setSuggestedMeal] = useState(null);
  const [generatingMeal, setGeneratingMeal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [mealSaved, setMealSaved] = useState(false);

  useEffect(() => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    // Fetch user profile
    const userProfileRef = ref(database, `users/${user.uid}/profile`);
    const unsubscribeProfile = onValue(userProfileRef, (snapshot) => {
      const profileData = snapshot.val();
      if (profileData) {
        setUserProfile(profileData);
      }
    });

    // Existing nutrition data fetch logic
    const today = new Date().toISOString().split('T')[0];
    const nutritionRef = ref(database, `users/${user.uid}/nutritionalValues/${today}`);
    
    const unsubscribeNutrition = onValue(nutritionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setNutritionData(data);
        setError(null);
      } else {
        setNutritionData({
          calories: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          protein: 0
        });
      }
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeNutrition();
    };
  }, []);

  // Keep existing renderBar and renderDataSection functions
  const renderBar = (value, goal, width) => {
    const percentage = Math.min((value / goal) * 100, 100);
    return (
      <View style={styles.barContainer}>
        <View style={[styles.bar, { width: `${percentage}%` }]} />
        <View style={[styles.goalBar, { width: `${width}%` }]} />
      </View>
    );
  };

  const renderDataSection = (data, title) => {
    const goals = {
      calories: 2000,
      carbs: 300,
      fat: 65,
      fiber: 25,
      protein: 50
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.chartContainer}>
          {Object.entries(data).map(([key, value], index) => (
            <View key={index} style={styles.dataRow}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                <Text style={styles.value}>{Math.round(value)}/{goals[key]}</Text>
              </View>
              {renderBar(value, goals[key], 100)}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const calculateRemainingNutrients = () => {
    const dailyGoals = {
      calories: 2000,
      protein: 50,
      carbs: 300,
      fat: 65,
      fiber: 25
    };

    return {
      calories: dailyGoals.calories - (nutritionData?.calories || 0),
      protein: dailyGoals.protein - (nutritionData?.protein || 0),
      carbs: dailyGoals.carbs - (nutritionData?.carbs || 0),
      fat: dailyGoals.fat - (nutritionData?.fat || 0),
      fiber: dailyGoals.fiber - (nutritionData?.fiber || 0)
    };
  };

  const searchFoodItem = async (query) => {
    try {
      const response = await fetch(
        `${API_ENDPOINT}/foods/search?api_key=${API_KEY}&query=${query}`
      );
      const data = await response.json();
      return data.foods[0];
    } catch (error) {
      console.error("Error searching food:", error);
      return null;
    }
  };

  // const saveMealToDatabase = async () => {
  //   try {
  //     const auth = getAuth();
  //     const user = auth.currentUser;
      
  //     if (!user || !suggestedMeal) {
  //       throw new Error('Missing required data');
  //     }

  //     // Save the suggested meal to the database
  //     const mealsRef = ref(database, `users/${user.uid}/meals`);
  //     const newMealRef = push(mealsRef);
  //     await set(newMealRef, suggestedMeal);

  //     setMealSaved(true);
  //   } catch (error) {
  //     console.error('Error saving meal:', error);
  //     setError('Failed to save meal');
  //   }
  // };

  
const saveMealToDatabase = async () => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user || !suggestedMeal) {
      throw new Error('Missing required data');
    }

    // Save the suggested meal to the database
    const mealsRef = ref(database, `users/${user.uid}/meals`);
    const newMealRef = push(mealsRef);
    await set(newMealRef, suggestedMeal);

    setMealSaved(true);
  } catch (error) {
    console.error('Error saving meal:', error);
    setError('Failed to save meal');
  }
};

  const generateMealSuggestion = async () => {
    setGeneratingMeal(true);
    setSuggestedMeal(null);
    setMealSaved(false); // Reset saved state when generating new meal
  
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user || !userProfile) {
        throw new Error('Missing required data');
      }
  
      const remainingNutrients = calculateRemainingNutrients();
      const userDiet = userProfile.diet.toLowerCase();
      const mealSize = remainingNutrients.calories > 500 ? 'main' : 'snack';
  
      // Select ingredients based on user's diet and remaining nutrients
      let proteinOptions = DIET_INGREDIENTS[userDiet] || DIET_INGREDIENTS.omnivore;
      let selectedIngredients = [];
      
      // Add a protein
      const protein = proteinOptions[Math.floor(Math.random() * proteinOptions.length)];
      const proteinData = await searchFoodItem(protein);
      if (proteinData) {
        selectedIngredients.push({
          name: proteinData.description,
          amount: 100,
          unit: 'g',
          nutrition: {
            calories: proteinData.foodNutrients.find(n => n.nutrientName === 'Energy')?.value || 0,
            protein: proteinData.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 0,
            carbs: proteinData.foodNutrients.find(n => n.nutrientName === 'Carbohydrates')?.value || 0,
            fat: proteinData.foodNutrients.find(n => n.nutrientName === 'Total fat')?.value || 0,
            fiber: proteinData.foodNutrients.find(n => n.nutrientName === 'Fiber')?.value || 0,
          }
        });
      }
  
      // Add a vegetable
      const veggie = COMMON_VEGGIES[Math.floor(Math.random() * COMMON_VEGGIES.length)];
      const veggieData = await searchFoodItem(veggie);
      if (veggieData) {
        selectedIngredients.push({
          name: veggieData.description,
          amount: 100,
          unit: 'g',
          nutrition: {
            calories: veggieData.foodNutrients.find(n => n.nutrientName === 'Energy')?.value || 0,
            protein: veggieData.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 0,
            carbs: veggieData.foodNutrients.find(n => n.nutrientName === 'Carbohydrates')?.value || 0,
            fat: veggieData.foodNutrients.find(n => n.nutrientName === 'Total fat')?.value || 0,
            fiber: veggieData.foodNutrients.find(n => n.nutrientName === 'Fiber')?.value || 0,
          }
        });
      }
  
      // Add a carb if it's a main meal
      if (mealSize === 'main') {
        const carb = COMMON_CARBS[Math.floor(Math.random() * COMMON_CARBS.length)];
        const carbData = await searchFoodItem(carb);
        if (carbData) {
          selectedIngredients.push({
            name: carbData.description,
            amount: 100,
            unit: 'g',
            nutrition: {
              calories: carbData.foodNutrients.find(n => n.nutrientName === 'Energy')?.value || 0,
              protein: carbData.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 0,
              carbs: carbData.foodNutrients.find(n => n.nutrientName === 'Carbohydrates')?.value || 0,
              fat: carbData.foodNutrients.find(n => n.nutrientName === 'Total fat')?.value || 0,
              fiber: carbData.foodNutrients.find(n => n.nutrientName === 'Fiber')?.value || 0,
            }
          });
        }
      }
  
      // Calculate total nutrition
      const totalNutrition = selectedIngredients.reduce((total, ingredient) => ({
        calories: total.calories + (ingredient.nutrition.calories || 0),
        protein: total.protein + (ingredient.nutrition.protein || 0),
        carbs: total.carbs + (ingredient.nutrition.carbs || 0),
        fat: total.fat + (ingredient.nutrition.fat || 0),
        fiber: total.fiber + (ingredient.nutrition.fiber || 0),
      }), {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      });
  
      // Generate meal name
      const mealName = `${selectedIngredients[0].name.split(',')[0]} with ${selectedIngredients[1].name.split(',')[0]}${selectedIngredients[2] ? ` and ${selectedIngredients[2].name.split(',')[0]}` : ''}`;
  
      // Generate simple directions
      const directions = [
        `Prepare ${selectedIngredients[0].name.split(',')[0]}`,
        `Cook ${selectedIngredients[1].name.split(',')[0]}`,
        selectedIngredients[2] ? `Prepare ${selectedIngredients[2].name.split(',')[0]}` : null,
        "Combine all ingredients and serve",
      ].filter(Boolean);
  
      const suggestedMeal = {
        name: mealName,
        ingredients: selectedIngredients,
        directions,
        nutrition: totalNutrition,
      };
  
      setSuggestedMeal(suggestedMeal);
    } catch (error) {
      console.error('Error generating meal suggestion:', error);
      setError('Failed to generate meal suggestion');
    } finally {
      setGeneratingMeal(false);
    }
  };

  // const generateMealSuggestion = async () => {
  //   setGeneratingMeal(true);
  //   setSuggestedMeal(null);
  //   setMealSaved(false);

  //   try {
  //     // ... (keep existing meal generation logic)
  //     const auth = getAuth();
  //     const user = auth.currentUser;
      
  //     if (!user || !userProfile) {
  //       throw new Error('Missing required data');
  //     }

  //     const remainingNutrients = calculateRemainingNutrients();
  //     const userDiet = userProfile.diet.toLowerCase();
  //     const mealSize = remainingNutrients.calories > 500 ? 'main' : 'snack';

  //     // Select ingredients based on user's diet and remaining nutrients
  //     let proteinOptions = DIET_INGREDIENTS[userDiet] || DIET_INGREDIENTS.omnivore;
  //     let selectedIngredients = [];
      
  //     // Add a protein
  //     const protein = proteinOptions[Math.floor(Math.random() * proteinOptions.length)];
  //     const proteinData = await searchFoodItem(protein);
  //     if (proteinData) {
  //       selectedIngredients.push({
  //         name: proteinData.description,
  //         amount: 100,
  //         unit: 'g',
  //         nutrition: {
  //           calories: proteinData.foodNutrients.find(n => n.nutrientName === 'Energy')?.value || 0,
  //           protein: proteinData.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 0,
  //           carbs: proteinData.foodNutrients.find(n => n.nutrientName === 'Carbohydrates')?.value || 0,
  //           fat: proteinData.foodNutrients.find(n => n.nutrientName === 'Total fat')?.value || 0,
  //           fiber: proteinData.foodNutrients.find(n => n.nutrientName === 'Fiber')?.value || 0,
  //         }
  //       });
  //     }

  //     // Add a vegetable
  //     const veggie = COMMON_VEGGIES[Math.floor(Math.random() * COMMON_VEGGIES.length)];
  //     const veggieData = await searchFoodItem(veggie);
  //     if (veggieData) {
  //       selectedIngredients.push({
  //         name: veggieData.description,
  //         amount: 100,
  //         unit: 'g',
  //         nutrition: {
  //           calories: veggieData.foodNutrients.find(n => n.nutrientName === 'Energy')?.value || 0,
  //           protein: veggieData.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 0,
  //           carbs: veggieData.foodNutrients.find(n => n.nutrientName === 'Carbohydrates')?.value || 0,
  //           fat: veggieData.foodNutrients.find(n => n.nutrientName === 'Total fat')?.value || 0,
  //           fiber: veggieData.foodNutrients.find(n => n.nutrientName === 'Fiber')?.value || 0,
  //         }
  //       });
  //     }

  //     // Add a carb if it's a main meal
  //     if (mealSize === 'main') {
  //       const carb = COMMON_CARBS[Math.floor(Math.random() * COMMON_CARBS.length)];
  //       const carbData = await searchFoodItem(carb);
  //       if (carbData) {
  //         selectedIngredients.push({
  //           name: carbData.description,
  //           amount: 100,
  //           unit: 'g',
  //           nutrition: {
  //             calories: carbData.foodNutrients.find(n => n.nutrientName === 'Energy')?.value || 0,
  //             protein: carbData.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 0,
  //             carbs: carbData.foodNutrients.find(n => n.nutrientName === 'Carbohydrates')?.value || 0,
  //             fat: carbData.foodNutrients.find(n => n.nutrientName === 'Total fat')?.value || 0,
  //             fiber: carbData.foodNutrients.find(n => n.nutrientName === 'Fiber')?.value || 0,
  //           }
  //         });
  //       }
  //     }

  //     // Calculate total nutrition
  //     const totalNutrition = selectedIngredients.reduce((total, ingredient) => ({
  //       calories: total.calories + (ingredient.nutrition.calories || 0),
  //       protein: total.protein + (ingredient.nutrition.protein || 0),
  //       carbs: total.carbs + (ingredient.nutrition.carbs || 0),
  //       fat: total.fat + (ingredient.nutrition.fat || 0),
  //       fiber: total.fiber + (ingredient.nutrition.fiber || 0),
  //     }), {
  //       calories: 0,
  //       protein: 0,
  //       carbs: 0,
  //       fat: 0,
  //       fiber: 0,
  //     });

  //     // Generate meal name
  //     const mealName = `${selectedIngredients[0].name.split(',')[0]} with ${selectedIngredients[1].name.split(',')[0]}${selectedIngredients[2] ? ` and ${selectedIngredients[2].name.split(',')[0]}` : ''}`;

  //     // Generate simple directions
  //     const directions = [
  //       `Prepare ${selectedIngredients[0].name.split(',')[0]}`,
  //       `Cook ${selectedIngredients[1].name.split(',')[0]}`,
  //       selectedIngredients[2] ? `Prepare ${selectedIngredients[2].name.split(',')[0]}` : null,
  //       "Combine all ingredients and serve",
  //     ].filter(Boolean);

  //     const suggestedMeal = {
  //       name: mealName,
  //       ingredients: selectedIngredients,
  //       directions,
  //       nutrition: totalNutrition,
  //     };

  //     setSuggestedMeal(suggestedMeal);
  //   } catch (error) {
  //     console.error('Error generating meal suggestion:', error);
  //     setError('Failed to generate meal suggestion');
  //   } finally {
  //     setGeneratingMeal(false);
  //   }
  // };

  // const generateMealSuggestion = async () => {
  //   setGeneratingMeal(true);
  //   setSuggestedMeal(null);

  //   try {
      

  //     const suggestedMeal = {
  //       name: mealName,
  //       ingredients: selectedIngredients,
  //       directions,
  //       nutrition: totalNutrition,
  //     };

  //     // Save the suggested meal to the database
  //     const mealsRef = ref(database, `users/${user.uid}/meals`);
  //     const newMealRef = push(mealsRef);
  //     await set(newMealRef, suggestedMeal);

  //     setSuggestedMeal(suggestedMeal);
  //   } catch (error) {
  //     console.error('Error generating meal suggestion:', error);
  //     setError('Failed to generate meal suggestion');
  //   } finally {
  //     setGeneratingMeal(false);
  //   }
  // };

  const renderMealSuggester = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Meal Suggester</Text>
      <View style={styles.mealSuggesterContainer}>
        {suggestedMeal ? (
          <>
            <Text style={styles.mealName}>{suggestedMeal.name}</Text>
            <Text style={styles.subTitle}>Ingredients:</Text>
            {suggestedMeal.ingredients.map((ingredient, index) => (
              <Text key={index} style={styles.ingredientText}>
                • {ingredient.amount}{ingredient.unit} {ingredient.name.split(',')[0]}
              </Text>
            ))}
            <Text style={styles.subTitle}>Directions:</Text>
            {suggestedMeal.directions.map((direction, index) => (
              <Text key={index} style={styles.directionText}>
                {index + 1}. {direction}
              </Text>
            ))}
            <Text style={styles.subTitle}>Nutritional Value:</Text>
            {Object.entries(suggestedMeal.nutrition).map(([key, value], index) => (
              <Text key={index} style={styles.nutritionText}>
                {key.charAt(0).toUpperCase() + key.slice(1)}: {Math.round(value)}
                {key === 'calories' ? ' kcal' : 'g'}
              </Text>
            ))}
            <View style={styles.buttonContainer}>
              <Pressable 
                style={[styles.actionButton, styles.regenerateButton]}
                onPress={generateMealSuggestion}
                disabled={generatingMeal}
              >
                <ChefHat size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>
                  {generatingMeal ? 'Generating...' : 'Regenerate'}
                </Text>
              </Pressable>
              <Pressable 
                style={[
                  styles.actionButton, 
                  styles.saveButton,
                  mealSaved && styles.savedButton
                ]}
                onPress={saveMealToDatabase}
                disabled={mealSaved}
              >
                <Text style={styles.actionButtonText}>
                  {mealSaved ? 'Saved!' : 'Save Meal'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.suggesterText}>
            Get a personalized meal suggestion based on your remaining nutritional needs
          </Text>
        )}
        {!suggestedMeal && (
          <Pressable 
            style={styles.generateButton}
            onPress={generateMealSuggestion}
            disabled={generatingMeal}
          >
            <ChefHat size={24} color="#FFFFFF" />
            <Text style={styles.generateButtonText}>
              {generatingMeal ? 'Generating...' : 'Generate Meal'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  // In the return statement, add renderMealSuggester between nutritionData section and planningButton
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>FusionBite</Text>
      </View>

      {nutritionData && renderDataSection(nutritionData, 'Daily Nutrient Intake')}
      
      {renderMealSuggester()}

      <Pressable 
        style={styles.planningButton}
        onPress={() => router.replace("/mealmanagement")}
      >
        {/* <Calendar size={24} color="#FFFFFF" /> */}
        <Text style={styles.planningButtonText}>View Meals</Text>
      </Pressable>

      <Pressable 
        style={styles.planningButton}
        onPress={() => router.replace("/mealplanner")}
      >
        <Calendar size={24} color="#FFFFFF" />
        <Text style={styles.planningButtonText}>Meal Planning</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E2E2E',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#2E2E2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#2E2E2E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 18,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerText: {
    color: '#C8B08C',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#C8B08C',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  chartContainer: {
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 15,
  },
  dataRow: {
    marginBottom: 15,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    color: '#E1E1E1',
    fontSize: 16,
  },
  value: {
    color: '#C8B08C',
    fontSize: 16,
  },
  barContainer: {
    height: 10,
    backgroundColor: '#2E2E2E',
    borderRadius: 5,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#4A6E52',
  },
  goalBar: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#C8B08C',
    opacity: 0.3,
  },
  planningButton: {
    backgroundColor: '#4A6E52',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginHorizontal: 20,
    marginBottom: 30,
  },
  planningButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  mealSuggesterContainer: {
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 15,
  },
  suggesterText: {
    color: '#E1E1E1',
    fontSize: 16,
    marginBottom: 15,
  },
  generateButton: {
    backgroundColor: '#4A6E52',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  mealName: {
    color: '#C8B08C',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subTitle: {
    color: '#E1E1E1',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
    marginBottom: 5,
  },
  nutritionText: {
    color: '#E1E1E1',
    fontSize: 14,
    marginBottom: 3,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  regenerateButton: {
    backgroundColor: '#4A6E52',
  },
  saveButton: {
    backgroundColor: '#C8B08C',
  },
  savedButton: {
    backgroundColor: '#8B7355',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  ingredientText: {
    color: '#E1E1E1',
    fontSize: 14,
    marginBottom: 3,
  },
  directionText: {
    color: '#E1E1E1',
    fontSize: 14,
    marginBottom: 3,
    marginLeft: 10,
  },
});