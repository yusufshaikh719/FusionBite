import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyB6fs6lB-87nCH36O6-Zfvnwf-miKyXz8E",
  authDomain: "fusionbite.firebaseapp.com",
  databaseURL: "https://fusionbite-default-rtdb.firebaseio.com",
  projectId: "fusionbite",
  storageBucket: "fusionbite.appspot.com",
  messagingSenderId: "251727286478",
  appId: "1:251727286478:web:05b5e5f513fe001e40009f",
  measurementId: "G-SL7G1FXW4Q"
};

const app = initializeApp(firebaseConfig);

const database = getDatabase(app);

export { database };
export default app;