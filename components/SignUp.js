import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { router } from 'expo-router';
import app from "../firebaseConfig";

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  
  async function handleSignUp() {
    if (!email || !password || !username) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    const auth = getAuth(app);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Sign up successful", userCredential.user.uid);
      router.replace("/login");
    } catch (error) {
      console.error("Sign up error:", error);
      Alert.alert("Sign Up Failed", getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  }

  function getErrorMessage(errorCode) {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email is already registered.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled.';
      case 'auth/weak-password':
        return 'Password is too weak.';
      default:
        return 'An error occurred during sign up. Please try again.';
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Sign Up</Text>
        </View>
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              placeholder="Username"
              placeholderTextColor="#2F3E46"
              style={styles.input}
              onChangeText={setUsername}
              value={username}
            />
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              placeholder="Email"
              placeholderTextColor="#2F3E46"
              style={styles.input}
              onChangeText={setEmail}
              value={email}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              placeholder="Password"
              placeholderTextColor="#2F3E46"
              style={styles.input}
              onChangeText={setPassword}
              value={password}
              secureTextEntry={true}
            />
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#CAD2C5",
    height: "100%",
    width: "100%",
  },
  innerContainer: {
    height: "100%",
    width: "100%",
    justifyContent: "flex-start",
    paddingTop: 20,
    paddingBottom: 15,
  },
  header: {
    alignItems: "center",
    marginTop: 130,
  },
  headerText: {
    color: "#354F52",
    fontWeight: "bold",
    letterSpacing: 3,
    fontSize: 45,
  },
  inputContainer: {
    alignItems: "center",
    marginHorizontal: 16,
    spaceBetween: 16,
    marginTop: 45,
  },
  inputWrapper: {
    backgroundColor: "#B0C4B1",
    padding: 16,
    borderRadius: 20,
    width: "100%",
    marginBottom: 20,
  },
  input: {
    color: "#2F3E46",
  },
  buttonContainer: {
    width: "100%",
    marginTop: 10,
  },
  button: {
    width: "100%",
    backgroundColor: "#52796F",
    padding: 12,
    borderRadius: 20,
    marginTop: 25,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  signUpContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    color: "#0284C7", // Sky blue color
    marginLeft: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  }
});
