import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Calendar, Clock } from 'lucide-react';

export default function Home() {
  const [timeFrame, setTimeFrame] = useState('day');
  
  const nutrientData = {
    day: [
      { name: 'Protein', amount: 65, goal: 80 },
      { name: 'Carbs', amount: 200, goal: 250 },
      { name: 'Fat', amount: 55, goal: 65 },
      { name: 'Fiber', amount: 20, goal: 25 },
    ],
    week: [
      { name: 'Protein', amount: 455, goal: 560 },
      { name: 'Carbs', amount: 1400, goal: 1750 },
      { name: 'Fat', amount: 385, goal: 455 },
      { name: 'Fiber', amount: 140, goal: 175 },
    ],
    month: [
      { name: 'Protein', amount: 1950, goal: 2400 },
      { name: 'Carbs', amount: 6000, goal: 7500 },
      { name: 'Fat', amount: 1650, goal: 1950 },
      { name: 'Fiber', amount: 600, goal: 750 },
    ],
  };

  const vitaminsData = {
    day: [
      { name: 'Vit A', amount: 700, goal: 900 },
      { name: 'Vit C', amount: 65, goal: 90 },
      { name: 'Vit D', amount: 15, goal: 20 },
      { name: 'Iron', amount: 14, goal: 18 },
    ],
    week: [
      { name: 'Vit A', amount: 4900, goal: 6300 },
      { name: 'Vit C', amount: 455, goal: 630 },
      { name: 'Vit D', amount: 105, goal: 140 },
      { name: 'Iron', amount: 98, goal: 126 },
    ],
    month: [
      { name: 'Vit A', amount: 21000, goal: 27000 },
      { name: 'Vit C', amount: 1950, goal: 2700 },
      { name: 'Vit D', amount: 450, goal: 600 },
      { name: 'Iron', amount: 420, goal: 540 },
    ],
  };

  const recentRecipes = [
    { id: 1, name: 'Grilled Chicken Salad', time: '25 mins' },
    { id: 2, name: 'Quinoa Buddha Bowl', time: '30 mins' },
    { id: 3, name: 'Salmon with Roasted Veggies', time: '35 mins' },
  ];

  const renderBar = (value, goal, width) => {
    const percentage = (value / goal) * 100;
    return (
      <View style={styles.barContainer}>
        <View style={[styles.bar, { width: `${percentage}%`, maxWidth: '100%' }]} />
        <View style={[styles.goalBar, { width: `${width}%` }]} />
      </View>
    );
  };

  const renderDataSection = (data, title) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chartContainer}>
        {data[timeFrame].map((item, index) => (
          <View key={index} style={styles.dataRow}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>{item.name}</Text>
              <Text style={styles.value}>{item.amount}/{item.goal}</Text>
            </View>
            {renderBar(item.amount, item.goal, 100)}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>FusionBite</Text>
      </View>
      
      <View style={styles.timeFrameSelector}>
        {['day', 'week', 'month'].map((time) => (
          <Pressable 
            key={time}
            style={[styles.timeButton, timeFrame === time && styles.activeTimeButton]}
            onPress={() => setTimeFrame(time)}
          >
            <Text style={[styles.timeButtonText, timeFrame === time && styles.activeTimeButtonText]}>
              {time.charAt(0).toUpperCase() + time.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {renderDataSection(nutrientData, 'Nutrient Intake')}
      {renderDataSection(vitaminsData, 'Vitamins & Minerals')}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Recipes</Text>
          <Pressable onPress={() => router.replace('/mealmanagement')}>
            <Text style={styles.seeAllText}>See All</Text>
          </Pressable>
        </View>
        {recentRecipes.map(recipe => (
          <Pressable 
            key={recipe.id} 
            style={styles.recipeCard}
            onPress={() => router.push({
              pathname: '/recipe-details',
              params: { recipeId: recipe.id }
            })}
          >
            <View style={styles.recipeInfo}>
              <Text style={styles.recipeName}>{recipe.name}</Text>
              <View style={styles.recipeTimeContainer}>
                <Clock size={16} color="#C8B08C" />
                <Text style={styles.recipeTime}>{recipe.time}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

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
  timeFrameSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 15,
    backgroundColor: '#3B3B3B',
  },
  activeTimeButton: {
    backgroundColor: '#4A6E52',
  },
  timeButtonText: {
    color: '#A3A3A3',
    fontSize: 16,
  },
  activeTimeButtonText: {
    color: '#FFFFFF',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
  seeAllText: {
    color: '#4A6E52',
    fontSize: 16,
  },
  recipeCard: {
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  recipeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeName: {
    color: '#E1E1E1',
    fontSize: 18,
  },
  recipeTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeTime: {
    color: '#C8B08C',
    fontSize: 14,
    marginLeft: 5,
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