import React from "react";
import { View, StyleSheet, Image, Pressable } from "react-native";

const homeImg = require("../../assets/images/home.png");
const cartImg = require("../../assets/images/cart.png");
const heartImg = require("../../assets/images/heart.png");
const messageImg = require("../../assets/images/message.png");
const profileImg = require("../../assets/images/profile.png");

export default function BottomNav() {
  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Pressable hitSlop={10}>
          <Image style={styles.icon} source={homeImg} />
        </Pressable>
        <Pressable hitSlop={10}>
          <Image style={styles.icon} source={cartImg} />
        </Pressable>
        <Pressable hitSlop={10}>
          <Image style={styles.icon} source={heartImg} />
        </Pressable>
        <Pressable hitSlop={10}>
          <Image style={styles.icon} source={messageImg} />
        </Pressable>
        <Pressable hitSlop={10}>
          <Image style={styles.icon} source={profileImg} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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

    // lighter shadow
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
});
