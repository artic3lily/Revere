import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";

export default function CategoryCard({ name, image, onPress, active = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, active && styles.cardActive]}
      android_ripple={{ color: "#00000010" }}
    >
      <View style={[styles.iconBox, active && styles.iconBoxActive]}>
        {image?.uri ? (
          <Image
            source={image}
            style={styles.image}
            resizeMode="cover"
            onError={() => console.log("❌ Category image failed:", name, image?.uri)}
          />
        ) : (
          // ✅ fallback so you KNOW if image prop is missing
          <Text style={styles.fallbackText}>{name?.[0] ?? "?"}</Text>
        )}
      </View>

      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 88, // ✅ bigger card
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 10,
  },

  cardActive: {},

  iconBox: {
    width: 74, // ✅ bigger image box
    height: 74, // ✅ bigger image box
    borderRadius: 20,
    backgroundColor: "#f2f2f2",
    marginBottom: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  iconBoxActive: {
    backgroundColor: "#eaeaea",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  fallbackText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
    opacity: 0.35,
  },

  text: {
    fontSize: 12,
    color: "#111",
    fontWeight: "700",
    textAlign: "center",
  },

  textActive: {
    textDecorationLine: "underline",
  },
});
