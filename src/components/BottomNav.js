import React, { useEffect, useState } from "react";
import { View, StyleSheet, Image, Pressable, Text } from "react-native";
import { auth, db } from "../config/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";

const homeImg = require("../../assets/images/home.png");
const cartImg = require("../../assets/images/cart.png");
const heartImg = require("../../assets/images/heart.png");
const messageImg = require("../../assets/images/message.png");
const profileImg = require("../../assets/images/profile.png");

export default function BottomNav({ navigation }) {
  const { theme } = useTheme();
  const [count, setCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const col = collection(db, "users", uid, "wishlist");
    const unsub = onSnapshot(
      col,
      (snap) => setCount(snap.size),
      (e) => console.log("Wishlist snap error", e)
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const col = collection(db, "users", uid, "cart");
    const unsub = onSnapshot(
      col,
      (snap) => setCartCount(snap.size),
      (e) => console.log("Cart snap error", e)
    );

    return () => unsub();
  }, []);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View
        style={[
          styles.nav,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {/* HOME */}
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Home")}>
          <Image style={[styles.icon, { tintColor: theme.icon }]} source={homeImg} />
        </Pressable>

        {/* CART */}
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Cart")}>
          <Image style={[styles.icon, { tintColor: theme.icon }]} source={cartImg} />
          {cartCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.badge }]} pointerEvents="none">
              <Text style={styles.badgeText}>
                {cartCount > 99 ? "99+" : String(cartCount)}
              </Text>
            </View>
          )}
        </Pressable>

        {/* WISHLIST */}
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Wishlist")}>
          <Image style={[styles.icon, { tintColor: theme.icon }]} source={heartImg} />
          {count > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.badge }]} pointerEvents="none">
              <Text style={styles.badgeText}>
                {count > 99 ? "99+" : String(count)}
              </Text>
            </View>
          )}
        </Pressable>

        {/* ✅ MESSAGES (NOW WORKS) */}
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Inbox")}>
          <Image style={[styles.icon, { tintColor: theme.icon }]} source={messageImg} />
        </Pressable>

        {/* PROFILE */}
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Profile")}>
          <Image style={[styles.icon, { tintColor: theme.icon }]} source={profileImg} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 64,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
    opacity: 0.9,
  },
  badge: {
    position: "absolute",
    right: -6,
    top: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "red",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
});
