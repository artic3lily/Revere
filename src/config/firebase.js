import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAYsLZRqR6lmIoEMnzDoZkpywRZaoLZLWg",
  authDomain: "revere-aa96b.firebaseapp.com",
  projectId: "revere-aa96b",
  storageBucket: "revere-aa96b.firebasestorage.app",
  messagingSenderId: "101107740521",
  appId: "1:101107740521:web:60883976094bd8400e5f78",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
