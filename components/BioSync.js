/**
 * BioSync — Onboarding flow for connecting health data.
 * 
 * In the web app, this allows manual entry of baseline health data
 * (sleep, resting heart rate, HRV, activity levels) to calibrate
 * the Digital Twin. In a future native mobile build, this would
 * connect directly to Health Connect / Apple HealthKit.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Animated, ScrollView, Platform, Linking } from 'react-native';
import { Activity, Moon, Heart, Zap, ChevronRight, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import app, { database } from '../firebaseConfig';
import apiService from '../services/apiService';
import { useAlert } from '../context/AlertContext';

// Top-level import for Health Connect — dynamic require() crashes Metro on Android
let HealthConnect = null;
try {
  HealthConnect = require('react-native-health-connect');
} catch (e) {
  console.log('react-native-health-connect not available:', e.message);
}

const ONBOARDING_STEPS = [
  {
    key: 'sleep',
    icon: Moon,
    title: 'Sleep Data',
    subtitle: 'How did you sleep last night?',
    fields: [
      { key: 'sleep_hours', label: 'Hours of Sleep', placeholder: '7.5', keyboardType: 'numeric' },
    ],
  },
  {
    key: 'heart',
    icon: Heart,
    title: 'Heart Rate',
    subtitle: 'Your cardiovascular baseline',
    fields: [
      { key: 'resting_heart_rate', label: 'Resting Heart Rate (bpm)', placeholder: '65', keyboardType: 'numeric' },
      { key: 'hrv', label: 'Heart Rate Variability (ms)', placeholder: '45', keyboardType: 'numeric' },
    ],
  },
  {
    key: 'activity',
    icon: Activity,
    title: 'Activity Level',
    subtitle: 'Your typical daily movement',
    fields: [
      { key: 'steps', label: 'Avg Daily Steps', placeholder: '8000', keyboardType: 'numeric' },
      { key: 'active_energy', label: 'Active Calories (kcal)', placeholder: '350', keyboardType: 'numeric' },
      { key: 'workout_minutes', label: 'Workout Minutes Today', placeholder: '30', keyboardType: 'numeric' },
    ],
  },
];

export default function BioSync() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [calibrated, setCalibrated] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const showAlert = useAlert();

  const auth = getAuth(app);
  const user = auth.currentUser;

  // Auto-detect Health Connect permissions on mount (handles post-permission-grant restart)
  useEffect(() => {
    if (Platform.OS === 'android' && HealthConnect && user) {
      (async () => {
        try {
          await HealthConnect.initialize();
          const granted = await HealthConnect.getGrantedPermissions();
          console.log('[BioSync] Mount: checking permissions:', JSON.stringify(granted));

          const hasSteps = granted.some(p => p.recordType === 'Steps' && p.accessType === 'read');
          const hasHR = granted.some(p => p.recordType === 'HeartRate' && p.accessType === 'read');

          if (hasSteps || hasHR) {
            console.log('[BioSync] Permissions already granted, auto-syncing...');
            await readAndSyncHealthData(hasSteps, hasHR);
          }
        } catch (e) {
          console.log('[BioSync] Auto-check skipped:', e.message);
        }
      })();
    }
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / (ONBOARDING_STEPS.length + 1),
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const handleInput = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
      setCurrentStep(prev => prev + 1);
    } else {
      handleSync();
    }
  };

  // Shared helper: read health data and write to Firebase
  const readAndSyncHealthData = async (hasSteps, hasHR) => {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const now = new Date().toISOString();
    const timeRangeFilter = { operator: 'between', startTime: todayStart, endTime: now };

    let entry = {};

    if (hasSteps) {
      try {
        const stepsResult = await HealthConnect.readRecords('Steps', { timeRangeFilter });
        const totalSteps = stepsResult.records?.reduce((acc, rec) => acc + (rec.count || 0), 0) || 0;
        if (totalSteps > 0) entry.steps = totalSteps;
        console.log('[BioSync] Steps:', totalSteps);
      } catch (e) {
        console.log('[BioSync] Could not read steps:', e.message);
      }
    }

    if (hasHR) {
      try {
        const hrResult = await HealthConnect.readRecords('HeartRate', { timeRangeFilter });
        const bpm = hrResult.records?.[0]?.samples?.[0]?.beatsPerMinute;
        if (bpm) entry.resting_heart_rate = bpm;
        console.log('[BioSync] Heart rate:', bpm);
      } catch (e) {
        console.log('[BioSync] Could not read heart rate:', e.message);
      }
    }

    // Always write to Firebase
    const healthRef = ref(database, `users/${user.uid}/healthData/latest`);
    await set(healthRef, {
      ...entry,
      source: 'health_connect',
      timestamp: new Date().toISOString(),
    });
    console.log('[BioSync] Health data saved to Firebase');

    // Try backend API too
    try {
      if (Object.keys(entry).length > 0) {
        await apiService.syncHealth(user.uid, [entry], 'native_android');
      }
    } catch (apiErr) {
      console.log('[BioSync] Backend sync failed (data saved to Firebase):', apiErr.message);
    }

    showAlert('success', Object.keys(entry).length > 0
      ? 'Health data synced successfully!'
      : 'Connected! No health data recorded yet today.');
    router.replace('/home');
  };

  const syncNativeHealth = async () => {
    try {
      if (Platform.OS !== 'android') {
        showAlert('error', 'Health Connect is only available on Android.');
        return false;
      }

      if (!HealthConnect) {
        showAlert('error', 'Health Connect module not available. Please reinstall the app.');
        return false;
      }

      if (!user) {
        showAlert('error', 'Please log in first.');
        return false;
      }

      console.log('[BioSync] Initializing Health Connect...');
      await HealthConnect.initialize();

      // Check if we already have permissions
      const granted = await HealthConnect.getGrantedPermissions();
      const hasSteps = granted.some(p => p.recordType === 'Steps' && p.accessType === 'read');
      const hasHR = granted.some(p => p.recordType === 'HeartRate' && p.accessType === 'read');

      if (hasSteps || hasHR) {
        // Permissions already granted — read data directly
        console.log('[BioSync] Permissions exist, reading data...');
        await readAndSyncHealthData(hasSteps, hasHR);
        return true;
      }

      // No permissions yet — open HC permission screen via requestPermission
      console.log('[BioSync] No permissions. Requesting permissions...');
      const requestedPermissions = [
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'SleepSession' }
      ];
      
      const newGranted = await HealthConnect.requestPermission(requestedPermissions);
      console.log('[BioSync] Permission request completed.', newGranted);

      const newHasSteps = newGranted.some(p => p.recordType === 'Steps' && p.accessType === 'read');
      const newHasHR = newGranted.some(p => p.recordType === 'HeartRate' && p.accessType === 'read');

      if (newHasSteps || newHasHR) {
        console.log('[BioSync] New permissions granted, reading data...');
        await readAndSyncHealthData(newHasSteps, newHasHR);
        return true;
      } else {
        showAlert('error', 'Permissions not granted. Without them, we cannot sync your health data.');
        return false;
      }
    } catch (e) {
      console.error('[BioSync] Health Connect error:', e);
      showAlert('error', `Health Connect error: ${e.message}`);
      return false;
    }
  };

  const handleSync = async () => {
    if (!user) {
      showAlert('error', 'Please log in first');
      return;
    }
    setSyncing(true);

    try {
      // 1. Try native sync if not on web
      let nativeSuccess = false;
      if (Platform.OS !== 'web') {
        nativeSuccess = await syncNativeHealth();
      }

      // 2. Fallback or merge with manual input
      const entry = {
        sleep_hours: parseFloat(formData.sleep_hours) || null,
        resting_heart_rate: parseFloat(formData.resting_heart_rate) || null,
        hrv: parseFloat(formData.hrv) || null,
        steps: parseInt(formData.steps) || null,
        active_energy: parseFloat(formData.active_energy) || null,
        workout_minutes: parseFloat(formData.workout_minutes) || null,
      };

      const cleanEntry = Object.fromEntries(
        Object.entries(entry).filter(([_, v]) => v !== null)
      );

      // Send manual data if present
      if (Object.keys(cleanEntry).length > 0) {
        await apiService.syncHealth(user.uid, [cleanEntry], 'manual');
      }

      // Finish animation
      setCalibrated(true);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }).start();

      setTimeout(() => {
        showAlert('success', 'Digital Twin calibrated!');
        router.replace('/home');
      }, 2000);
    } catch (error) {
      console.error('Sync error:', error);
      showAlert('error', 'Failed to sync health data. Continuing with defaults.');
      router.replace('/home');
    } finally {
      setSyncing(false);
    }
  };

  const step = ONBOARDING_STEPS[currentStep];
  const IconComp = step?.icon;

  if (calibrated) {
    return (
      <View style={styles.container}>
        <View style={styles.calibratingContainer}>
          <Animated.View style={[styles.pulseCircle, {
            transform: [{
              scale: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1.2],
              })
            }],
            opacity: progressAnim,
          }]}>
            <Zap size={48} color="#C8B08C" />
          </Animated.View>
          <Text style={styles.calibratingTitle}>Calibrating Digital Twin</Text>
          <Text style={styles.calibratingSubtitle}>
            Analyzing your biological data...
          </Text>
          <Animated.View style={[styles.progressBar, {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            })
          }]} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <Animated.View style={[styles.progressFill, {
          width: progressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bio-Sync</Text>
        <Text style={styles.headerSubtitle}>
          Connect your health data to calibrate your Digital Twin
        </Text>
      </View>

      {/* Native Health Connect Button */}
      {Platform.OS !== 'web' && (
        <Pressable
          style={styles.nativeSyncButton}
          onPress={() => {
            console.log('Triggering Native Health Sync...');
            syncNativeHealth();
          }}
        >
          <Activity size={24} color="#FFFFFF" />
          <Text style={styles.nativeSyncText}>
            Connect to {Platform.OS === 'android' ? 'Google Health' : 'Apple Health'}
          </Text>
        </Pressable>
      )}

      {/* Step card */}
      <Animated.View style={[styles.stepCard, { opacity: fadeAnim }]}>
        <View style={styles.stepIconContainer}>
          {IconComp && <IconComp size={32} color="#C8B08C" />}
        </View>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepSubtitle}>{step.subtitle}</Text>

        {step.fields.map(field => (
          <View key={field.key} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={field.placeholder}
              placeholderTextColor="#A3A3A3"
              keyboardType={field.keyboardType || 'default'}
              value={formData[field.key] || ''}
              onChangeText={(val) => handleInput(field.key, val)}
            />
          </View>
        ))}
      </Animated.View>

      {/* Navigation */}
      <View style={styles.navContainer}>
        <Pressable
          style={styles.skipButton}
          onPress={() => router.replace('/home')}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>

        <Pressable
          style={[styles.nextButton, syncing && styles.disabledButton]}
          onPress={handleNext}
          disabled={syncing}
        >
          {currentStep === ONBOARDING_STEPS.length - 1 ? (
            <>
              <Check size={20} color="#FFFFFF" />
              <Text style={styles.nextText}>
                {syncing ? 'Syncing...' : 'Calibrate Twin'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.nextText}>Next</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>

      {/* Source note */}
      <View style={styles.sourceNote}>
        <Text style={styles.sourceText}>
          📱 Health Connect (Android) and Apple HealthKit integration
          available in the mobile companion app
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E2E2E',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#5B5B5B',
    borderRadius: 2,
    marginBottom: 30,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A6E52',
    borderRadius: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTitle: {
    color: '#C8B08C',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: '#A3A3A3',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  nativeSyncButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 25,
    gap: 10,
    elevation: 3,
  },
  nativeSyncText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepCard: {
    backgroundColor: '#3B3B3B',
    borderRadius: 20,
    padding: 25,
    marginBottom: 25,
  },
  stepIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2E2E2E',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 15,
  },
  stepTitle: {
    color: '#E1E1E1',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  stepSubtitle: {
    color: '#A3A3A3',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 15,
  },
  fieldLabel: {
    color: '#C8B08C',
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#2E2E2E',
    borderRadius: 12,
    padding: 14,
    color: '#E1E1E1',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#5B5B5B',
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  skipButton: {
    padding: 12,
  },
  skipText: {
    color: '#A3A3A3',
    fontSize: 14,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#4A6E52',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  sourceNote: {
    backgroundColor: '#3B3B3B',
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
  },
  sourceText: {
    color: '#A3A3A3',
    fontSize: 12,
    textAlign: 'center',
  },
  calibratingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  pulseCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3B3B3B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#C8B08C',
  },
  calibratingTitle: {
    color: '#C8B08C',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  calibratingSubtitle: {
    color: '#A3A3A3',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#4A6E52',
    borderRadius: 2,
  },
});
