import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal, FlatList } from "react-native";
import { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { router } from 'expo-router';
import { getAuth } from "firebase/auth";
import { ref, set, get } from "firebase/database";
import app, { database } from "../firebaseConfig";
import { GoogleGenAI } from "@google/genai";
import Constants from 'expo-constants';
import { useAlert } from '../app/AlertContext';

const GOOGLE_AI_API_KEY = Constants.expoConfig.extra.googleAiApiKey;
const ai = new GoogleGenAI({apiKey: GOOGLE_AI_API_KEY})

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const ACTIVITY_OPTIONS = ['Sedentary', 'Light', 'Moderate', 'Very Active'];
const DIET_OPTIONS = ['Balanced', 'Low Carb', 'Keto', 'Vegan', 'Vegetarian', 'Paleo'];
const GOAL_OPTIONS = ['Weight Loss', 'Muscle Gain', 'Maintenance', 'Improved Health'];

export default function BiometricInfo() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [pickerVisible, setPickerVisible] = useState(false);
  const [currentPickerField, setCurrentPickerField] = useState(null);
  const showAlert = useAlert();

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
      showAlert('error', "User not found. Please log in again.");
      return;
    }

    try {
      const userProfileRef = ref(database, `users/${user.uid}/profile`);
      const snapshot = await get(userProfileRef);

      if (snapshot.exists()) {
        const profileData = snapshot.val();
        setFormData(currentData => ({
          ...currentData,
          ...profileData
        }));
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
      showAlert('error', "Failed to load profile data. Please try again.");
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
      placeholder: 'Select your gender',
      type: 'dropdown',
      options: GENDER_OPTIONS,
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
      placeholder: 'Select your activity level',
      type: 'dropdown',
      options: ACTIVITY_OPTIONS,
      validate: (value) => {
        if (!value) return 'Activity level is required';
        return '';
      }
    },
    {
      key: 'goals',
      label: 'Goals',
      placeholder: 'Select your fitness/health goals',
      type: 'dropdown',
      options: GOAL_OPTIONS,
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
      placeholder: 'Select your dietary preferences',
      type: 'dropdown',
      options: DIET_OPTIONS,
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
      showAlert('error', "Please correct the errors in the form");
      return;
    }

    if (!user) {
      showAlert('error', "User not found. Please log in again.");
      return;
    }

    setLoading(true);

    try {
      const userProfileRef = ref(database, `users/${user.uid}/profile`);
      await set(userProfileRef, formData);

      const prompt = `Generate the number of calories that should be eaten every day based on the following criteria:
      - User profile:
        * Age: ${formData.age}
        * Gender: ${formData.gender}
        * Height: ${formData.height}cm
        * Weight: ${formData.weight}kg
        * Activity level: ${formData.activityLevel}
        * Fitness/health goals: ${formData.goals}
      - Dietary restrictions:
        * Diet type: ${formData.diet}
        * Allergies: ${formData.allergies}
        * Medical conditions: ${formData.medicalConditions}
      
      Additional Information:
      - When calculating the amount of calories that should be eaten every day, err on the side of a lower amount
      
      Respond ONLY with one number, NO additional text, No additional punctuation like commas`;
      const responseText = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      console.log(responseText);
      const userProfileCalorieRef = ref(database, `users/${user.uid}/profile/calorie`)
      const calories = parseInt(responseText.candidates[0].content.parts[0].text);
      await set(userProfileCalorieRef, calories);

      console.log("Profile data saved successfully");
      showAlert('success', "Profile updated successfully");
      router.replace('/home');
    } catch (error) {
      console.error("Error saving profile data:", error);
      if (error.code === 'PERMISSION_DENIED') {
        showAlert('error', "You don't have permission to save profile data. Please make sure you're logged in.");
      } else {
        showAlert('error', "Failed to save profile data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const openPicker = (field) => {
    setCurrentPickerField(field);
    setPickerVisible(true);
  };

  const handleSelectOption = (option) => {
    handleInputChange(currentPickerField.key, option);
    setPickerVisible(false);
  };

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
                {field.type === 'dropdown' ? (
                  <Pressable
                    style={styles.dropdownTrigger}
                    onPress={() => openPicker(field)}
                  >
                    <Text style={[styles.input, !formData[field.key] && { color: '#A3A3A3' }]}>
                      {formData[field.key] || field.placeholder}
                    </Text>
                  </Pressable>
                ) : (
                  <TextInput
                    placeholder={field.placeholder}
                    placeholderTextColor="#A3A3A3"
                    style={styles.input}
                    onChangeText={(value) => handleInputChange(field.key, value)}
                    value={formData[field.key].toString()}
                    keyboardType={field.keyboardType || 'default'}
                  />
                )}
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

      <Modal
        visible={pickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select {currentPickerField?.label}</Text>
            <FlatList
              data={currentPickerField?.options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.optionItem}
                  onPress={() => handleSelectOption(item)}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </Pressable>
              )}
            />
            <Pressable
              style={styles.cancelButton}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
    outlineStyle: 'none',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#3B3B3B',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
    borderColor: '#5B5B5B',
    borderWidth: 1,
  },
  modalTitle: {
    color: '#C8B08C',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#5B5B5B',
  },
  optionText: {
    color: '#E1E1E1',
    fontSize: 18,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#4A6E52',
    borderRadius: 15,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dropdownTrigger: {
    width: '100%',
  },
});