import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBkmoiBgSCZnR8uoCutdomZWl2tBfoAKHc",
  authDomain: "round-transport-b8t0d.firebaseapp.com",
  projectId: "round-transport-b8t0d",
  storageBucket: "round-transport-b8t0d.firebasestorage.app",
  messagingSenderId: "570809635590",
  appId: "1:570809635590:web:3baf7f4eda5f2acd678487"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore with custom database ID
export const db = getFirestore(app, "ai-studio-fa94c90b-8bdb-4459-9af3-59cb6d80bbcc");
