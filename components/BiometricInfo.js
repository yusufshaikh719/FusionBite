import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
  } from "react-native";
  import { StatusBar } from "expo-status-bar";
  import { useState } from "react";
  import { getAuth } from "firebase/auth";
  import { getDatabase, ref, set } from "firebase/database";
  import { router } from 'expo-router';
  import app, { database } from "../firebaseConfig";
  
  export default function BiometricInfo() {
    const [loading, setLoading] = useState(false);
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
  
    const formFields = [
      { key: 'age', label: 'Age' },
      { key: 'gender', label: 'Gender' },
      { key: 'height', label: 'Height' },
      { key: 'weight', label: 'Weight' },
      { key: 'activityLevel', label: 'Activity Level' },
      { key: 'goals', label: 'Goals' },
      { key: 'allergies', label: 'Allergies' },
      { key: 'medicalConditions', label: 'Medical Conditions' },
      { key: 'diet', label: 'Diet' },
      { key: 'timeConstraint', label: 'Time Constraint' },
    ];
  
    const handleInputChange = (key, value) => {
      setFormData(prevData => ({
        ...prevData,
        [key]: value
      }));
    };
  
    async function handleSubmit() {
      const auth = getAuth(app);
      const user = auth.currentUser;
      
      setLoading(true);
      const db = getDatabase(app);
      
      try {
        await set(ref(db, 'users/' + user.uid + '/profile'), formData);
        console.log("Profile data saved successfully");
        router.replace('/home');
      } catch (error) {
        console.error("Error saving profile data:", error);
        Alert.alert("Error", "Failed to save profile data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  
    return (
      <ScrollView style={styles.container}>
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
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    placeholderTextColor="#A3A3A3"
                    style={styles.input}
                    onChangeText={(value) => handleInputChange(field.key, value)}
                    value={formData[field.key]}
                  />
                </View>
              </View>
            ))}
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Saving...' : 'Save Profile'}
                </Text>
              </TouchableOpacity>
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
  });