import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";

import LoginScreen from "../screens/auth/LoginScreen";
import SignupScreen from "../screens/auth/SignupScreen";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SearchScreen from "../screens/SearchScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import WishlistScreen from "../screens/WishlistScreen";
import CartScreen from "../screens/CartScreen";
import UserChatScreen from "../screens/UserChatScreen";
import ChatbotScreen from "../screens/ChatbotScreen";
import InboxScreen from "../screens/InboxScreen";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db } from "../config/firebase";



const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setUser(null);
          setLoading(false);
          return;
        }

        //Check Firestore user status
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? snap.data() : null;

        const status = data?.accountStatus || "active";

        if (status === "banned") {
          const reason = data?.banReason ? `\nReason: ${data.banReason}` : "";
          alert("Your account has been banned." + reason);

          await signOut(auth);

          setUser(null);
          setLoading(false);
          return;
        }

        //allowed
        setUser(u);
        setLoading(false);
      } catch (e) {
        console.log("Auth guard error:", e?.message || e);

        // remembee fail-safe
        await signOut(auth);
        setUser(null);
        setLoading(false);
      }
    });

    return unsub;
  }, []);


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="Chatbot" component={ChatbotScreen} options={{ title: "Style Assistant" }}/>
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="UserChat" component={UserChatScreen} />
            <Stack.Screen name="Inbox" component={InboxScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
