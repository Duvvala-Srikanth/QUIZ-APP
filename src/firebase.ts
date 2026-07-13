import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAhUVikg2LJ4UptYDxa6SmN3oErAB0wBdM",
  authDomain: "quiz-app-6dc5d.firebaseapp.com",
  projectId: "quiz-app-6dc5d",
  storageBucket: "quiz-app-6dc5d.firebasestorage.app",
  messagingSenderId: "717878242423",
  appId: "1:717878242423:web:40aa1c9e9d8853c01b2a72",
  measurementId: "G-MV9VTM250J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore with custom database ID
export const db = getFirestore(app, "ai-studio-fa94c90b-8bdb-4459-9af3-59cb6d80bbcc");
