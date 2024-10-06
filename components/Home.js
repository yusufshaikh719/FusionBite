import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Calendar } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import { getAuth } from 'firebase/auth';

export default function Home() {
  const [nutritionData, setNutritionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];

    const nutritionRef = ref(database, `users/${user.uid}/nutritionalValues/${currentDate}`);
    
    const unsubscribe = onValue(nutritionRef, (snapshot) => {
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
    }, (error) => {
      console.error('Error fetching nutrition data:', error);
      setError('Failed to fetch nutrition data');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C8B08C" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>FusionBite</Text>
      </View>

      {nutritionData && renderDataSection(nutritionData, 'Daily Nutrient Intake')}

      <Pressable 
        style={styles.planningButton}
        onPress={() => router.replace("/mealplanner")}
      >
        <Calendar size={24} color="#FFFFFF" />
        <Text style={styles.planningButtonText}>Get Meal Suggestions</Text>
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
});