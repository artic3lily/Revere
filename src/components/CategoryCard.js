import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

export default function CategoryCard({ name, onPress, active = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, active && styles.cardActive]}
      android_ripple={{ color: "#00000010", borderless: false }}
    >
      <View style={[styles.iconBox, active && styles.iconBoxActive]} />
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 64,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "transparent",  
    borderWidth: 0,              
    marginRight: 10,            
  },

  cardActive: {
    // forrelatable
  },

  iconBox: {
    width: 54,                
    height: 54,
    borderRadius: 16,
    backgroundColor: "#f2f2f2",
    marginBottom: 6,
  },

  iconBoxActive: {
    backgroundColor: "#eaeaea",
  },

  text: {
    fontSize: 12,
    color: "#111",
    fontWeight: "700",
  },

  textActive: {
    textDecorationLine: "underline",
  },
});

