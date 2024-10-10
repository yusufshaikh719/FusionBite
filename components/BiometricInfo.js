import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { router } from 'expo-router';
import { getAuth } from "firebase/auth";
import { ref, set, get } from "firebase/database";
import app, { database } from "../firebaseConfig";
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';

const GOOGLE_AI_API_KEY = Constants.expoConfig.extra.googleAiApiKey;
const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

export default function BiometricInfo() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [userProfileData, setUserProfileData] = useState({});
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    height: '',
    weight: '',
    activityLevel: '',
    goals: '',
    allergies: '',
    medicalConditions: '',
    diet: '',
    timeConstraint: '',
  });

  const auth = getAuth(app);
  const user = auth.currentUser;

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    if (!user) {
      Alert.alert("Error", "User not found. Please log in again.");
      return;
    }

    try {
      const userProfileRef = ref(database, `users/${user.uid}/profile`);
      const snapshot = await get(userProfileRef);
      
      if (snapshot.exists()) {
        const profileData = snapshot.val();
        const userData = snapshot.val();
      if (userData) {
        setUserProfileData(userData);
      }
        setFormData(currentData => ({
          ...currentData,
          ...profileData
        }));
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
      Alert.alert("Error", "Failed to load profile data. Please try again.");
    }
  };

  const formFields = [
    { 
      key: 'age', 
      label: 'Age',
      placeholder: 'Enter your age (e.g., 25)',
      keyboardType: 'numeric',
      validate: (value) => {
        const age = parseInt(value);
        if (!value) return 'Age is required';
        if (isNaN(age) || age < 1 || age > 120) return 'Please enter a valid age between 1 and 120';
        return '';
      }
    },
    { 
      key: 'gender', 
      label: 'Gender',
      placeholder: 'Enter your gender',
      validate: (value) => !value ? 'Gender is required' : ''
    },
    { 
      key: 'height', 
      label: 'Height (cm)',
      placeholder: 'Enter your height in cm (e.g., 170)',
      keyboardType: 'numeric',
      validate: (value) => {
        const height = parseInt(value);
        if (!value) return 'Height is required';
        if (isNaN(height) || height < 50 || height > 300) return 'Please enter a valid height between 50 and 300 cm';
        return '';
      }
    },
    { 
      key: 'weight', 
      label: 'Weight (kg)',
      placeholder: 'Enter your weight in kg (e.g., 70)',
      keyboardType: 'numeric',
      validate: (value) => {
        const weight = parseInt(value);
        if (!value) return 'Weight is required';
        if (isNaN(weight) || weight < 20 || weight > 500) return 'Please enter a valid weight between 20 and 500 kg';
        return '';
      }
    },
    { 
      key: 'activityLevel', 
      label: 'Activity Level',
      placeholder: 'Enter your activity level (Sedentary/Light/Moderate/Very Active)',
      validate: (value) => {
        const validLevels = ['sedentary', 'light', 'moderate', 'very active'];
        if (!value) return 'Activity level is required';
        if (!validLevels.includes(value.toLowerCase())) return 'Please enter a valid activity level';
        return '';
      }
    },
    { 
      key: 'goals', 
      label: 'Goals',
      placeholder: 'Enter your fitness/health goals',
      validate: (value) => !value ? 'Goals are required' : ''
    },
    { 
      key: 'allergies', 
      label: 'Allergies',
      placeholder: 'List any food allergies (or type "None")',
      validate: () => ''
    },
    { 
      key: 'medicalConditions', 
      label: 'Medical Conditions',
      placeholder: 'List any relevant medical conditions (or type "None")',
      validate: () => ''
    },
    { 
      key: 'diet', 
      label: 'Diet',
      placeholder: 'Enter your dietary preferences',
      validate: (value) => !value ? 'Diet information is required' : ''
    },
    { 
      key: 'timeConstraint', 
      label: 'Time Constraint (hours/day)',
      placeholder: 'Enter available time for cooking (e.g., 3.5)',
      keyboardType: 'numeric',
      validate: (value) => {
        const time = parseFloat(value);
        if (!value) return 'Time constraint is required';
        if (isNaN(time) || time < 0 || time > 24) return 'Please enter a valid time between 0 and 24 hours';
        return '';
      }
    },
  ];

  const handleInputChange = (key, value) => {
    setFormData(prevData => ({
      ...prevData,
      [key]: value
    }));
    
    if (errors[key]) {
      setErrors(prevErrors => ({
        ...prevErrors,
        [key]: ''
      }));
    }
  };

  const validateForm = () => {
    let newErrors = {};
    let isValid = true;

    formFields.forEach(field => {
      const error = field.validate(formData[field.key]);
      if (error) {
        newErrors[field.key] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  async function handleSubmit() {
    if (!validateForm()) {
      Alert.alert("Error", "Please correct the errors in the form");
      return;
    }

    if (!user) {
      Alert.alert("Error", "User not found. Please log in again.");
      return;
    }

    setLoading(true);
    
    try {
      const userProfileRef = ref(database, `users/${user.uid}/profile`);
      await set(userProfileRef, formData);
      
      const prompt = `Generate the number of calories that should be eaten every day based on the following criteria:
      - User profile:
        * Age: ${userProfileData.age}
        * Gender: ${userProfileData.gender}
        * Height: ${userProfileData.height}cm
        * Weight: ${userProfileData.weight}kg
        * Activity level: ${userProfileData.activityLevel}
        * Fitness/health goals: ${userProfileData.goals}
      - Dietary restrictions:
        * Diet type: ${userProfileData.diet}
        * Allergies: ${userProfileData.allergies}
        * Medical conditions: ${userProfileData.medicalConditions}
      
      Additonal Information:
      - When calculating the amount of calories that should be eaten every day, err on the side of a lower amount
      
      Respond ONLY with one number, NO additional text, No additional punctuation like commas`;
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      console.log(responseText)
      const userProfileCalorieRef = ref(database, `users/${user.uid}/profile/calorie`)
      await set(userProfileCalorieRef, parseInt(responseText));

      console.log("Profile data saved successfully");
      Alert.alert("Success", "Profile updated successfully");
      router.replace('/home');
    } catch (error) {
      console.error("Error saving profile data:", error);
      if (error.code === 'PERMISSION_DENIED') {
        Alert.alert("Error", "You don't have permission to save profile data. Please make sure you're logged in.");
      } else {
        Alert.alert("Error", "Failed to save profile data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar style="light" hidden={true} />
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Profile Info</Text>
        </View>
        <View style={styles.inputContainer}>
          {formFields.map((field) => (
            <View key={field.key} style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  placeholder={field.placeholder}
                  placeholderTextColor="#A3A3A3"
                  style={styles.input}
                  onChangeText={(value) => handleInputChange(field.key, value)}
                  value={formData[field.key].toString()}
                  keyboardType={field.keyboardType || 'default'}
                />
              </View>
              {errors[field.key] ? (
                <Text style={styles.errorText}>{errors[field.key]}</Text>
              ) : null}
            </View>
          ))}
          <View style={styles.buttonContainer}>
            <Pressable 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Saving...' : 'Save Profile'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#2E2E2E",
    flex: 1,
  },
  innerContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 30,
  },
  headerText: {
    color: "#C8B08C",
    fontWeight: "bold",
    letterSpacing: 3,
    fontSize: 45,
  },
  inputContainer: {
    marginHorizontal: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: "#C8B08C",
    fontSize: 18,
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: "#3B3B3B",
    padding: 16,
    borderRadius: 20,
    borderColor: "#5B5B5B",
    borderWidth: 1,
  },
  input: {
    color: "#E1E1E1",
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: "#4A6E52",
    padding: 12,
    borderRadius: 20,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    marginTop: 5,
  },
});