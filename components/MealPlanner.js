import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { getAuth } from 'firebase/auth';
import { ref, get, set, onValue } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import { ArrowBigLeftDash, Trash2 } from 'lucide-react';
import { router } from 'expo-router';

const MEAL_TIMES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export default function MealPlanner() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableMeals, setAvailableMeals] = useState({});
  const [selectedMeals, setSelectedMeals] = useState({
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snacks: [],
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState('');

  const auth = getAuth(app);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user?.uid) return;

    const mealsRef = ref(database, `users/${user.uid}/meals`);
    const todayPlanRef = ref(database, `users/${user.uid}/mealPlans/${getCurrentDate()}`);

    // Fetch available meals
    onValue(mealsRef, (snapshot) => {
      if (snapshot.exists()) {
        setAvailableMeals(snapshot.val());
      }
      setLoading(false);
    });

    // Fetch today's meal plan if exists
    get(todayPlanRef).then((snapshot) => {
      if (snapshot.exists()) {
        const planData = snapshot.val();
        setSelectedMeals(planData.meals || {
          Breakfast: [],
          Lunch: [],
          Dinner: [],
          Snacks: [],
        });
      }
    });
  }, [user?.uid]);

  const getCurrentDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const calculateNutritionTotals = (meals) => {
    const totals = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    };

    Object.entries(meals).forEach(([_, mealIds]) => {
      mealIds.forEach(mealId => {
        const meal = availableMeals[mealId];
        if (meal?.nutrition) {
          Object.keys(totals).forEach(nutrient => {
            totals[nutrient] += meal.nutrition[nutrient] || 0;
          });
        }
      });
    });

    return totals;
  };

  const handleAddMeal = (mealTime) => {
    setCurrentMealTime(mealTime);
    setModalVisible(true);
  };

  const handleSelectMeal = (mealId) => {
    const updatedMeals = {
      ...selectedMeals,
      [currentMealTime]: [...(selectedMeals[currentMealTime] || []), mealId],
    };
    setSelectedMeals(updatedMeals);
    setModalVisible(false);
  };

  const handleRemoveMeal = (mealTime, index) => {
    const updatedMeals = {
      ...selectedMeals,
      [mealTime]: selectedMeals[mealTime].filter((_, i) => i !== index),
    };
    setSelectedMeals(updatedMeals);
  };

  const saveMealPlan = async () => {
    if (!user?.uid) return;

    setSaving(true);
    try {
      const date = getCurrentDate();
      const nutritionTotals = calculateNutritionTotals(selectedMeals);

      // Save meal plan
      const mealPlanRef = ref(database, `users/${user.uid}/mealPlans/${date}`);
      await set(mealPlanRef, {
        meals: selectedMeals,
        date,
      });

      // Save nutritional values separately
      const nutritionRef = ref(database, `users/${user.uid}/nutritionalValues/${date}`);
      await set(nutritionRef, nutritionTotals);

      Alert.alert("Success", "Meal plan saved successfully!");
    } catch (error) {
      console.error("Error saving meal plan:", error);
      Alert.alert("Error", "Failed to save meal plan. Please try again.");
    } finally {
      setSaving(false);
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
    <View style={styles.container}>
      <View>
        <Pressable style={styles.backButton} onPress={() => router.replace("/home")}>
          <ArrowBigLeftDash color="#C8B08C" />
        </Pressable>
      </View>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Today's Meal Plan</Text>
        
        {MEAL_TIMES.map((mealTime) => (
          <View key={mealTime} style={styles.mealTimeSection}>
            <Text style={styles.mealTimeTitle}>{mealTime}</Text>
            {selectedMeals[mealTime]?.map((mealId, index) => (
              <View key={`${mealTime}-${index}`} style={styles.mealItem}>
                <Text style={styles.mealName}>{availableMeals[mealId]?.name}</Text>
                <Pressable 
                  onPress={() => handleRemoveMeal(mealTime, index)}
                  style={styles.removeButton}
                >
                  <Trash2 size={20} color="#FF6B6B" />
                </Pressable>
              </View>
            ))}
            <Pressable 
              style={styles.addButton}
              onPress={() => handleAddMeal(mealTime)}
            >
              <Text style={styles.addButtonText}>+ Add {mealTime}</Text>
            </Pressable>
          </View>
        ))}

        <Pressable 
          style={[styles.saveButton, saving && styles.savingButton]}
          onPress={saveMealPlan}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Meal Plan'}
          </Text>
        </Pressable>

        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select a meal</Text>
              <FlatList
                data={Object.entries(availableMeals)}
                keyExtractor={([id]) => id}
                renderItem={({ item: [id, meal] }) => (
                  <Pressable
                    style={styles.modalItem}
                    onPress={() => handleSelectMeal(id)}
                  >
                    <Text style={styles.modalItemText}>{meal.name}</Text>
                  </Pressable>
                )}
              />
              <Pressable
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Cancel</Text>
              </Pressable>
            </View>
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
    marginTop: 40,
  },
  mealTimeSection: {
    marginBottom: 20,
  },
  mealTimeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4A6E52',
    marginBottom: 10,
  },
  mealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3B3B3B',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  mealName: {
    color: '#E1E1E1',
    fontSize: 16,
  },
  removeButton: {
    padding: 5,
  },
  addButton: {
    backgroundColor: '#4A6E52',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#4A6E52',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  savingButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#3B3B3B',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#C8B08C',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#4A6E52',
  },
  modalItemText: {
    color: '#E1E1E1',
    fontSize: 16,
  },
  closeButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#FF6B6B',
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});