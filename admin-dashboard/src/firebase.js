// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔥 Replace with your Firebase Web config (Firebase Console > Project settings > Web app)
const firebaseConfig = {
  apiKey: "AIzaSyAYsLZRqR6lmIoEMnzDoZkpywRZaoLZLWg",
  authDomain: "revere-aa96b.firebaseapp.com",
  projectId: "revere-aa96b",
  storageBucket: "revere-aa96b.firebasestorage.app",
  messagingSenderId: "101107740521",
  appId: "1:101107740521:web:60803976094bd84d0e57f8",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
