import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Modal, StyleSheet, Text } from "react-native";
import { BlurView } from "expo-blur";
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
import FollowListScreen from "../screens/FollowListScreen";
import RatingListScreen from "../screens/RatingListScreen";
import UserChatScreen from "../screens/UserChatScreen";
import ChatbotScreen from "../screens/ChatbotScreen";
import InboxScreen from "../screens/InboxScreen";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db } from "../config/firebase";
import TryOnScreen from "../screens/TryOnScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import OrderDetailsScreen from "../screens/OrderDetailsScreen";


const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isInitialAppLoad = React.useRef(true);
  const currentUserUidRef = React.useRef(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          currentUserUidRef.current = null;
          setUser(null);
          setLoading(false);
          isInitialAppLoad.current = false;
          return;
        }

        if (currentUserUidRef.current === u.uid) {
          setUser(u);
          setLoading(false);
          return;
        }

        currentUserUidRef.current = u.uid;

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
        if (!isInitialAppLoad.current) {
          setShowSuccessModal(true);
          setUser(u);
          setLoading(false);
          setTimeout(() => {
            setShowSuccessModal(false);
          }, 2000);
        } else {
          setUser(u);
          setLoading(false);
          isInitialAppLoad.current = false;
        }
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
            <Stack.Screen name="FollowList" component={FollowListScreen} />
            <Stack.Screen name="RatingList" component={RatingListScreen} />
            <Stack.Screen name="TryOn" component={TryOnScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>

      <Modal transparent visible={showSuccessModal} animationType="fade">
        <BlurView intensity={60} tint="dark" style={styles.blurOverlay}>
          <View style={styles.successCard}>
            <Text style={styles.successText}>You are successfully logged in! (ᵔᗜᵔ)◜</Text>
          </View>
        </BlurView>
      </Modal>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  blurOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  successCard: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 16,
    overflow: "hidden",
  },
  successText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
});
