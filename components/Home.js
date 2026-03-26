/**
 * Home — Live Digital Twin Dashboard
 *
 * The central view of FusionBite. Shows the user's current metabolic state:
 *   • Glycogen Reserve gauge
 *   • Insulin Sensitivity Score
 *   • Predicted Glucose Trajectory (chart)
 *   • Intent-based Meal Generation
 *   • Quick links to Meal Management, Meal Planner, Bio-Sync
 */

import { View, Text, StyleSheet, ScrollView, Pressable, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import React, { useState, useEffect } from 'react';
import { Calendar, ChefHat, User, LogOut, Settings, Zap, Moon, Heart, Activity } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import GlucoseChart from './GlucoseChart';
import apiService from '../services/apiService';

const INTENTS = [
  { key: 'breakfast', label: '🌅 Breakfast', color: '#D4A574' },
  { key: 'lunch', label: '☀️ Lunch', color: '#4A6E52' },
  { key: 'dinner', label: '🌙 Dinner', color: '#5B7DB1' },
  { key: 'snack', label: '🍎 Snack', color: '#C8B08C' },
];

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Digital Twin state
  const [twinState, setTwinState] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [glucoseTrajectory, setGlucoseTrajectory] = useState([]);

  // Meal generation
  const [generatingMeal, setGeneratingMeal] = useState(false);
  const [generatedMeal, setGeneratedMeal] = useState(null);
  const [mealTrajectory, setMealTrajectory] = useState([]);

  const auth = getAuth(app);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    // Listen to user profile from Firebase
    const profileRef = ref(database, `users/${user.uid}/profile`);
    const unsubProfile = onValue(profileRef, (snapshot) => {
      setUserProfile(snapshot.val());
    });

    // Load dashboard data from the backend
    loadDashboard();

    return () => unsubProfile();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await apiService.getDashboard(user.uid);
      setTwinState(data.twin_state);
      setHealthStatus(data.health_status);
      setGlucoseTrajectory(data.glucose_trajectory);
      setError(null);
    } catch (err) {
      console.warn('Backend not available, using defaults:', err.message);
      // Use default state if backend is not running
      setTwinState({
        bayesian_parameters: { p1: 0.028, p2: 0.025, p3: 0.000013, gastric_base: 0.05, glut4_factor: 1.0 },
        current_state: { estimated_glucose: 95, estimated_glycogen: 80, insulin_sensitivity_score: 1.0, estimated_insulin: 10 },
      });
      setHealthStatus({
        today_steps: 0, today_active_energy: 0,
        last_sleep_hours: null, last_hrv: null,
        insulin_sensitivity_modifier: 1.0, glut4_modifier: 1.0,
      });
      setGlucoseTrajectory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.replace('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleGenerateMeal = async (intent) => {
    setGeneratingMeal(true);
    setGeneratedMeal(null);
    setMealTrajectory([]);

    try {
      const result = await apiService.generateMeal(user.uid, intent);
      setGeneratedMeal(result.recipe);
      setMealTrajectory(result.trajectory);
    } catch (err) {
      console.error('Meal generation failed:', err);
      setError('Failed to generate meal. Is the backend running?');
    } finally {
      setGeneratingMeal(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A6E52" />
        <Text style={styles.loadingText}>Loading Digital Twin...</Text>
      </View>
    );
  }

  const currentState = twinState?.current_state || {};
  const glycogen = currentState.estimated_glycogen || 80;
  const glucose = currentState.estimated_glucose || 95;
  const sensitivity = currentState.insulin_sensitivity_score || 1.0;

  const getGlycogenLabel = (pct) => {
    if (pct > 70) return 'Fully Charged';
    if (pct > 40) return 'Moderate';
    if (pct > 20) return 'Depleted';
    return 'Critically Low';
  };

  const getSensitivityLabel = (score) => {
    if (score >= 1.2) return 'Excellent';
    if (score >= 0.9) return 'Normal';
    if (score >= 0.7) return 'Reduced';
    return 'Low (Sleep Tax)';
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>FusionBite</Text>
          <Pressable style={styles.profileIcon} onPress={() => setShowDropdown(!showDropdown)}>
            <User color="#C8B08C" size={24} />
          </Pressable>
        </View>

        {/* ── Twin Status Cards ── */}
        <View style={styles.statusGrid}>
          {/* Glycogen Reserve */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Zap size={18} color="#C8B08C" />
              <Text style={styles.statusLabel}>Glycogen Reserve</Text>
            </View>
            <Text style={styles.statusValue}>{Math.round(glycogen)}%</Text>
            <View style={styles.gaugeBar}>
              <View style={[styles.gaugeFill, {
                width: `${glycogen}%`,
                backgroundColor: glycogen > 60 ? '#4A6E52' : glycogen > 30 ? '#D4A574' : '#FF6B6B',
              }]} />
            </View>
            <Text style={styles.statusSubtext}>{getGlycogenLabel(glycogen)}</Text>
          </View>

          {/* Insulin Sensitivity */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Activity size={18} color="#C8B08C" />
              <Text style={styles.statusLabel}>Insulin Sensitivity</Text>
            </View>
            <Text style={styles.statusValue}>{sensitivity.toFixed(2)}</Text>
            <View style={styles.gaugeBar}>
              <View style={[styles.gaugeFill, {
                width: `${Math.min(sensitivity * 50, 100)}%`,
                backgroundColor: sensitivity >= 0.9 ? '#4A6E52' : sensitivity >= 0.7 ? '#D4A574' : '#FF6B6B',
              }]} />
            </View>
            <Text style={styles.statusSubtext}>{getSensitivityLabel(sensitivity)}</Text>
          </View>
        </View>

        {/* Current Glucose */}
        <View style={styles.glucoseCard}>
          <Text style={styles.glucoseLabel}>Current Estimated Glucose</Text>
          <Text style={[styles.glucoseValue, {
            color: glucose > 140 ? '#FF6B6B' : glucose < 70 ? '#D4A574' : '#4A6E52',
          }]}>{Math.round(glucose)} <Text style={styles.glucoseUnit}>mg/dL</Text></Text>
        </View>

        {/* Health Telemetry Quick View */}
        {healthStatus && (
          <View style={styles.telemetryRow}>
            {healthStatus.last_sleep_hours && (
              <View style={styles.telemetryItem}>
                <Moon size={14} color="#A3A3A3" />
                <Text style={styles.telemetryText}>{healthStatus.last_sleep_hours}h sleep</Text>
              </View>
            )}
            {healthStatus.today_steps > 0 && (
              <View style={styles.telemetryItem}>
                <Activity size={14} color="#A3A3A3" />
                <Text style={styles.telemetryText}>{healthStatus.today_steps.toLocaleString()} steps</Text>
              </View>
            )}
            {healthStatus.last_hrv && (
              <View style={styles.telemetryItem}>
                <Heart size={14} color="#A3A3A3" />
                <Text style={styles.telemetryText}>HRV {healthStatus.last_hrv}ms</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Glucose Trajectory Chart ── */}
        <View style={styles.section}>
          <GlucoseChart
            trajectory={glucoseTrajectory}
            title="Predicted Glucose Trajectory"
          />
        </View>

        {/* ── Intent-Based Meal Generation ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What do you need?</Text>
          <View style={styles.intentGrid}>
            {INTENTS.map(intent => (
              <Pressable
                key={intent.key}
                style={[styles.intentButton, { borderColor: intent.color }]}
                onPress={() => handleGenerateMeal(intent.key)}
                disabled={generatingMeal}
              >
                <Text style={styles.intentLabel}>{intent.label}</Text>
              </Pressable>
            ))}
          </View>

          {generatingMeal && (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="small" color="#C8B08C" />
              <Text style={styles.generatingText}>
                Optimizing macros & generating recipe...
              </Text>
            </View>
          )}
        </View>

        {/* ── Generated Meal ── */}
        {generatedMeal && (
          <View style={styles.section}>
            <View style={styles.mealCard}>
              <Text style={styles.mealName}>{generatedMeal.name}</Text>

              {/* Macro Summary */}
              <View style={styles.macroRow}>
                {Object.entries(generatedMeal.nutrition || {}).map(([key, val]) => (
                  <View key={key} style={styles.macroItem}>
                    <Text style={styles.macroValue}>{Math.round(val)}</Text>
                    <Text style={styles.macroLabel}>
                      {key === 'calories' ? 'kcal' : `g ${key}`}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Ingredients */}
              <Text style={styles.mealSubtitle}>Ingredients</Text>
              {generatedMeal.ingredients?.map((ing, i) => (
                <Text key={i} style={styles.ingredientText}>
                  • {ing.amount}{ing.unit} {ing.item}
                </Text>
              ))}

              {/* Directions */}
              <Text style={styles.mealSubtitle}>Directions</Text>
              {generatedMeal.directions?.map((dir, i) => (
                <Text key={i} style={styles.directionText}>{i + 1}. {dir}</Text>
              ))}
            </View>

            {/* Post-meal glucose prediction */}
            {mealTrajectory.length > 0 && (
              <View style={{ marginTop: 15 }}>
                <GlucoseChart
                  trajectory={mealTrajectory}
                  title="If you eat this meal..."
                />
              </View>
            )}
          </View>
        )}

        {/* ── Navigation Buttons ── */}
        <Pressable style={styles.navButton} onPress={() => router.push('/mealmanagement')}>
          <ChefHat size={20} color="#FFFFFF" />
          <Text style={styles.navButtonText}>Meal Library</Text>
        </Pressable>

        <Pressable style={styles.navButton} onPress={() => router.push('/mealplanner')}>
          <Calendar size={20} color="#FFFFFF" />
          <Text style={styles.navButtonText}>Meal Planner</Text>
        </Pressable>

        <Pressable style={[styles.navButton, { backgroundColor: '#5B7DB1' }]} onPress={() => router.push('/biosync')}>
          <Heart size={20} color="#FFFFFF" />
          <Text style={styles.navButtonText}>Sync Health Data</Text>
        </Pressable>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Dropdown menu */}
      {showDropdown && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
            <View style={styles.dropdownOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.dropdownContainer}>
                  <Pressable style={styles.dropdownItem} onPress={() => { setShowDropdown(false); router.push('/biometricinfo'); }}>
                    <Settings size={20} color="#C8B08C" />
                    <Text style={styles.dropdownText}>Edit Profile</Text>
                  </Pressable>
                  <Pressable style={[styles.dropdownItem, styles.lastDropdownItem]} onPress={() => { setShowDropdown(false); handleSignOut(); }}>
                    <LogOut size={20} color="#FF6B6B" />
                    <Text style={[styles.dropdownText, { color: '#FF6B6B' }]}>Sign Out</Text>
                  </Pressable>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}
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
  loadingText: {
    color: '#C8B08C',
    marginTop: 10,
    fontSize: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
  },
  headerText: {
    color: '#C8B08C',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  profileIcon: {
    padding: 8,
  },

  // ── Status Cards ──
  statusGrid: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    gap: 10,
    marginBottom: 10,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 15,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statusLabel: {
    color: '#A3A3A3',
    fontSize: 12,
  },
  statusValue: {
    color: '#E1E1E1',
    fontSize: 28,
    fontWeight: 'bold',
  },
  gaugeBar: {
    height: 6,
    backgroundColor: '#2E2E2E',
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusSubtext: {
    color: '#A3A3A3',
    fontSize: 11,
  },

  // ── Glucose Card ──
  glucoseCard: {
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  glucoseLabel: {
    color: '#A3A3A3',
    fontSize: 12,
    marginBottom: 4,
  },
  glucoseValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  glucoseUnit: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#A3A3A3',
  },

  // ── Telemetry Row ──
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
    marginBottom: 5,
  },
  telemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  telemetryText: {
    color: '#A3A3A3',
    fontSize: 12,
  },

  // ── Sections ──
  section: {
    marginHorizontal: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#C8B08C',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  // ── Intent Buttons ──
  intentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  intentButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#3B3B3B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  intentLabel: {
    color: '#E1E1E1',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Generating ──
  generatingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  generatingText: {
    color: '#C8B08C',
    fontSize: 14,
  },

  // ── Generated Meal ──
  mealCard: {
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 18,
  },
  mealName: {
    color: '#C8B08C',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    paddingVertical: 10,
    backgroundColor: '#2E2E2E',
    borderRadius: 10,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    color: '#E1E1E1',
    fontSize: 18,
    fontWeight: 'bold',
  },
  macroLabel: {
    color: '#A3A3A3',
    fontSize: 10,
    marginTop: 2,
  },
  mealSubtitle: {
    color: '#E1E1E1',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  ingredientText: {
    color: '#E1E1E1',
    fontSize: 14,
    marginBottom: 3,
  },
  directionText: {
    color: '#E1E1E1',
    fontSize: 14,
    marginBottom: 4,
    marginLeft: 8,
  },

  // ── Nav Buttons ──
  navButton: {
    backgroundColor: '#4A6E52',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    gap: 10,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // ── Dropdown ──
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
});