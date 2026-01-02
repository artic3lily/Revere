import { View, StyleSheet, Image } from "react-native";

// Assign images to variables
const homeImg = require("../../assets/images/home.png");
const cartImg = require("../../assets/images/cart.png");
const heartImg = require("../../assets/images/heart.png");
const messageImg = require("../../assets/images/message.png");
const profileImg = require("../../assets/images/profile.png");

export default function BottomNav() {
  return (
    <View style={styles.nav}>
      <Image style={styles.icon} source={homeImg} />
      <Image style={styles.icon} source={cartImg} />
      <Image style={styles.icon} source={heartImg} />
      <Image style={styles.icon} source={messageImg} />
      <Image style={styles.icon} source={profileImg} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 24, 
    borderRadius: 8, 
    backgroundColor: "#fff",
    marginHorizontal: 16, 
    marginBottom: 45, 
  
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 6, // Android shadow
  },
  icon: {
    width: 28,
    height: 28,
    resizeMode: "contain",
    marginBottom: 0, 
  },
});


