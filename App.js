import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "./src/config/firebase";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider } from "./src/context/ThemeContext";

export default function App() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      setChecking(false);
    });
    return unsub;
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}