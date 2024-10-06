import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyB6fs6lB-87nCH36O6-Zfvnwf-miKyXz8E",
  authDomain: "fusionbite.firebaseapp.com",
  databaseURL: "https://fusionbite-default-rtdb.firebaseio.com/",
  projectId: "fusionbite",
  storageBucket: "fusionbite.appspot.com",
  messagingSenderId: "251727286478",
  appId: "1:251727286478:web:e99fe5b1b6f3815740009f",
  measurementId: "G-DKB2E420WE"
};

const app = initializeApp(firebaseConfig);

const database = getDatabase(app);

export { database };
export default app;