import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions"; 

const firebaseConfig = {
  apiKey: "AIzaSyAYsLZRqR6lmIoEMnzDoZkpywRZaoLZLWg",
  authDomain: "revere-aa96b.firebaseapp.com",
  projectId: "revere-aa96b",
  storageBucket: "revere-aa96b.firebasestorage.app",
  messagingSenderId: "101107740521",
  appId: "1:101107740521:web:60803976094bd84d0e57f8",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1"); 
