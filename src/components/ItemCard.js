import { View, Text, StyleSheet } from "react-native";

export default function ItemCard({ title, price }) {
  return (
    <View style={styles.card}>
      <View style={styles.image} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.price}>{price}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 120,
    marginRight: 14,
  },
  image: {
    height: 120,
    borderRadius: 14,
    backgroundColor: "#eaeaea",
    marginBottom: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: "500",
  },
  price: {
    fontSize: 12,
    color: "#777",
  },
});
