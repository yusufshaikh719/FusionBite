import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { router } from 'expo-router';

import app from '../firebaseConfig';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleLogin() {
        if (!email || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        setLoading(true);
        const auth = getAuth(app);
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("Login successful", userCredential.user.uid);
            router.replace({
                pathname: '/home',
                params: {
                    userId: userCredential.user.uid,
                }
            });
        } catch (error) {
            console.error("Login error:", error);
            Alert.alert("Login Failed", getErrorMessage(error.code));
        } finally {
            setLoading(false);
        }
    }

    function getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/user-disabled':
                return 'This user has been disabled.';
            case 'auth/user-not-found':
                return 'No user found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            default:
                return 'An error occurred during login. Please try again.';
        }
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" hidden={true} />
            <View style={styles.innerContainer}>
                <View style={styles.header}>
                    <Text style={styles.headerText}>Civic Union</Text>
                </View>
                <View style={styles.inputContainer}>
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
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>
                                {loading ? 'Logging in...' : 'Login'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.signUpContainer}>
                        <View style={styles.row}>
                            <Text>Don't have an account?</Text>
                            <TouchableOpacity onPress={() => router.replace("/signup")}>
                                <Text style={styles.signUpText}>Sign up</Text>
                            </TouchableOpacity>
                        </View>
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
    color: "#5EB9A2", // Sky blue color
    marginLeft: 5,
  },
  buttonDisabled: {
        opacity: 0.7,
  },
});
