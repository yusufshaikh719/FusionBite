import React, { createContext, useContext, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { AlertCircle, Check } from 'lucide-react-native';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState({ visible: false, type: '', message: '' });
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const showAlert = (type, message) => {
    setAlert({ visible: true, type, message });
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    if (type === 'success') {
      setTimeout(() => {
        handleDismiss();
      }, 2000);
    }
  };

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setAlert({ ...alert, visible: false }));
  };

  return (
    <AlertContext.Provider value={showAlert}>
      {children}
      {alert.visible && (
        <Animated.View
          style={[
            styles.alertContainer,
            {
              backgroundColor: alert.type === 'error' ? '#FF6B6B' : '#4A6E52',
              transform: [{ translateY: slideAnim }],
              opacity,
            },
          ]}
        >
          {alert.type === 'error' ? (
            <AlertCircle color="white" size={24} />
          ) : (
            <Check color="white" size={24} />
          )}
          <Text style={styles.alertText}>{alert.message}</Text>
          <Pressable onPress={handleDismiss} style={styles.alertDismiss}>
            <Text style={styles.alertDismissText}>✕</Text>
          </Pressable>
        </Animated.View>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  alertContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
  },
  alertText: {
    color: 'white',
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
  },
  alertDismiss: {
    padding: 5,
  },
  alertDismissText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});