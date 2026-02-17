import React, { useEffect, useState } from "react";
import { View, StyleSheet, Image, Pressable, Text } from "react-native";
import { auth, db } from "../config/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";

const homeImg = require("../../assets/images/home.png");
const cartImg = require("../../assets/images/cart.png");
const heartImg = require("../../assets/images/heart.png");
const messageImg = require("../../assets/images/message.png");
const profileImg = require("../../assets/images/profile.png");

export default function BottomNav({ navigation }) {
  const { theme } = useTheme();

  const [wishlistCount, setWishlistCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  const uid = auth.currentUser?.uid;

  // WISHLIST
  useEffect(() => {
    if (!uid) {
      setWishlistCount(0);
      return;
    }
    const colRef = collection(db, "users", uid, "wishlist");
    const unsub = onSnapshot(
      colRef,
      (snap) => setWishlistCount(snap.size),
      (e) => console.log("Wishlist snap error", e?.message || e)
    );
    return () => unsub();
  }, [uid]);

  // CART
  useEffect(() => {
    if (!uid) {
      setCartCount(0);
      return;
    }
    const colRef = collection(db, "users", uid, "cart");
    const unsub = onSnapshot(
      colRef,
      (snap) => setCartCount(snap.size),
      (e) => console.log("Cart snap error", e?.message || e)
    );
    return () => unsub();
  }, [uid]);

  // UNREAD CHAT COUNT
  useEffect(() => {
    if (!uid) {
      setUnreadChats(0);
      return;
    }

    // No orderBy = no index needed
    const q = query(collection(db, "threads"), where("members", "array-contains", uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        let count = 0;
        snap.forEach((d) => {
          const data = d.data();
          const unread = data?.unread?.[uid] || 0;
          if (unread > 0) count += 1; // count chats, not messages
        });
        setUnreadChats(count);
      },
      (e) => console.log("Unread threads error", e?.code, e?.message || e)
    );

    return () => unsub();
  }, [uid]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.nav, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {/* HOME */}
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Home")}>
          <Image style={[styles.icon, { tintColor: theme.icon }]} source={homeImg} />
        </Pressable>

        {/* CART */}
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Cart")}>
          <Image style={[styles.icon, { tintColor: theme.icon }]} source={cartImg} />
          {cartCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.badge }]} pointerEvents="none">
              <Text style={styles.badgeText}>{cartCount > 99 ? "99+" : String(cartCount)}</Text>
            </View>
          )}
        </Pressable>

        {/* WISHLIST */}
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Wishlist")}>
          <Image style={[styles.icon, { tintColor: theme.icon }]} source={heartImg} />
          {wishlistCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.badge }]} pointerEvents="none">
              <Text style={styles.badgeText}>
                {wishlistCount > 99 ? "99+" : String(wishlistCount)}
              </Text>
            </View>
          )}
        </Pressable>

        {/* MESSAGES */}
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Inbox")}>
          <Image style={[styles.icon, { tintColor: theme.icon }]} source={messageImg} />
          {unreadChats > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.badge }]} pointerEvents="none">
              <Text style={styles.badgeText}>
                {unreadChats > 99 ? "99+" : String(unreadChats)}
              </Text>
            </View>
          )}
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
