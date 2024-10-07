import { View, Text, StyleSheet, ScrollView, Pressable, TouchableWithoutFeedback } from 'react-native';
import React, { useState, useEffect } from 'react';
import { Calendar, ChefHat, User, LogOut, Settings } from 'lucide-react';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { ref, onValue, push, set } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';

const FDA_API_KEY = Constants.expoConfig.extra.fdaApiKey;
const FDA_API_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1';
const GOOGLE_AI_API_KEY = Constants.expoConfig.extra.googleAiApiKey;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

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
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    const userProfileRef = ref(database, `users/${user.uid}/profile`);
    const unsubscribeProfile = onValue(userProfileRef, (snapshot) => {
      const profileData = snapshot.val();
      if (profileData) {
        setUserProfile(profileData);
      }
    });

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

  const handleSignOut = async () => {
    try {
      const auth = getAuth();
      await auth.signOut();
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

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
        `${FDA_API_ENDPOINT}/foods/search?api_key=${FDA_API_KEY}&query=${query}`
      );
      const data = await response.json();
      return data.foods[0];
    } catch (error) {
      console.error("Error searching food:", error);
      return null;
    }
  };
  
const saveMealToDatabase = async () => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user || !suggestedMeal) {
      throw new Error('Missing required data');
    }

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
  setMealSaved(false);

  try {
    const remainingNutrients = calculateRemainingNutrients();
    
    // Generate meal suggestion using Google AI
    const prompt = `Generate a healthy meal suggestion based on the following criteria:
      - User diet: ${userProfile.diet}
      - Remaining nutritional needs:
        * Calories: ${remainingNutrients.calories}
        * Protein: ${remainingNutrients.protein}g
        * Carbs: ${remainingNutrients.carbs}g
        * Fat: ${remainingNutrients.fat}g
        * Fiber: ${remainingNutrients.fiber}g
      - Time constraint: ${userProfile.timeConstraint} hours
      - Allergies: ${userProfile.allergies}
      
      Respond ONLY with a JSON object in this exact format, no additional text:
      {
        "name": "Meal Name",
        "ingredients": ["100g ingredient1", "150g ingredient2"],
        "directions": ["Step 1", "Step 2", "Step 3"]
      }`;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let mealSuggestion;
    try {
      mealSuggestion = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('Failed to parse AI response as JSON:', responseText);
      throw new Error('Invalid meal suggestion format received from AI');
    }

    // Validate the parsed JSON has the expected structure
    if (!mealSuggestion.name || !Array.isArray(mealSuggestion.ingredients) || !Array.isArray(mealSuggestion.directions)) {
      throw new Error('Meal suggestion is missing required properties');
    }

    // Process ingredients and get nutritional data
    const processedIngredients = [];
    for (const ingredientStr of mealSuggestion.ingredients) {
      const match = ingredientStr.match(/(\d+)g\s+(.+)/);
      if (match) {
        const amount = parseInt(match[1]);
        const ingredientName = match[2];
        const nutritionData = await searchFoodItem(ingredientName);
        
        if (nutritionData) {
          processedIngredients.push({
            name: nutritionData.description,
            amount: amount,
            unit: 'g',
            nutrition: {
              calories: (nutritionData.foodNutrients.find(n => n.nutrientName === 'Energy')?.value || 0) * amount / 100,
              protein: (nutritionData.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 0) * amount / 100,
              carbs: (nutritionData.foodNutrients.find(n => n.nutrientName === 'Carbohydrates')?.value || 0) * amount / 100,
              fat: (nutritionData.foodNutrients.find(n => n.nutrientName === 'Total fat')?.value || 0) * amount / 100,
              fiber: (nutritionData.foodNutrients.find(n => n.nutrientName === 'Fiber')?.value || 0) * amount / 100,
            }
          });
        }
      }
    }

    // Calculate total nutrition
    const totalNutrition = processedIngredients.reduce((total, ingredient) => ({
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

    const suggestedMeal = {
      name: mealSuggestion.name,
      ingredients: processedIngredients,
      directions: mealSuggestion.directions,
      nutrition: totalNutrition,
    };

    setSuggestedMeal(suggestedMeal);
  } catch (error) {
    console.error('Error generating meal suggestion:', error);
    setError(`Failed to generate meal suggestion: ${error.message}`);
  } finally {
    setGeneratingMeal(false);
  }
};

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

  const headerWithProfile = (
    <View style={styles.headerContainer}>
      <Text style={styles.headerText}>FusionBite</Text>
      <Pressable 
        style={styles.profileIcon}
        onPress={() => setShowDropdown(!showDropdown)}
      >
        <User color="#C8B08C" size={24} />
      </Pressable>
    </View>
  );

  const dropdownMenu = showDropdown && (
    <View style={StyleSheet.absoluteFill}>
      <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
        <View style={styles.dropdownOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dropdownContainer}>
              <Pressable 
                style={styles.dropdownItem}
                onPress={() => {
                  setShowDropdown(false);
                  router.push('/biometricinfo');
                }}
              >
                <Settings size={20} color="#C8B08C" />
                <Text style={styles.dropdownText}>Edit Profile</Text>
              </Pressable>
              <Pressable 
                style={[styles.dropdownItem, styles.lastDropdownItem]}
                onPress={() => {
                  setShowDropdown(false);
                  handleSignOut();
                }}
              >
                <LogOut size={20} color="#FF6B6B" />
                <Text style={[styles.dropdownText, { color: '#FF6B6B' }]}>Sign Out</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );

  return (
    <>
      <ScrollView style={styles.container}>
        {headerWithProfile}
        {/* {dropdownMenu} */}

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
      {dropdownMenu}
    </>
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
    backgroundColor: '#3B3B3B', // Dark grey background similar to other sections
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 25, // Match spacing with other sections
  },
  suggesterText: {
    color: '#E1E1E1', // Consistent text color across the app
    fontSize: 16,
    marginBottom: 15,
  },
  generateButton: {
    backgroundColor: '#4A6E52', // Dark greenish color, aligned with the theme
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  generateButtonText: {
    color: '#FFFFFF', // White text for better contrast
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  mealName: {
    color: '#C8B08C', // Beige color for section titles
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
    backgroundColor: '#4A6E52', // Dark greenish color to match the theme
  },
  saveButton: {
    backgroundColor: '#C8B08C', // Beige color for consistency
  },
  savedButton: {
    backgroundColor: '#8B7355', // Muted brown for saved state
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  profileIcon: {
    padding: 8,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 110,
    right: 20,
    backgroundColor: '#3B3B3B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#5B5B5B',
    zIndex: 1000,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#5B5B5B',
  },
  dropdownText: {
    color: '#E1E1E1',
    marginLeft: 10,
    fontSize: 16,
  },
  lastDropdownItem: {
    borderBottomWidth: 0,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 110,
    right: 20,
    backgroundColor: '#3B3B3B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#5B5B5B',
    zIndex: 1000,
    elevation: 5,
  },
});