import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";

export default function ItemCard({ title, price, image, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      android_ripple={{ color: "#00000010", borderless: false }}
    >
      <Image
        source={image}
        style={styles.image}
        resizeMode="cover"
      />

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.price} numberOfLines={1}>
          {price}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 150,
    marginRight: 14,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
  },
  image: {
    height: 140,
    width: "100%",
    backgroundColor: "#ededed",
  },
  meta: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111",
  },
  price: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
    opacity: 0.7,
  },
});
