import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  // Your existing config values
  apiKey: "AIzaSyB6fs6lB-87nCH36O6-Zfvnwf-miKyXz8E",
  authDomain: "fusionbite.firebaseapp.com",
  databaseURL: "https://fusionbite-default-rtdb.firebaseio.com/",
  projectId: "fusionbite",
  storageBucket: "fusionbite.appspot.com",
  messagingSenderId: "251727286478",
  appId: "1:251727286478:web:e99fe5b1b6f3815740009f",
  measurementId: "G-DKB2E420WE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);

export { database };
export default app;