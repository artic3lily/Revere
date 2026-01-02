import { View, Text, StyleSheet } from "react-native";

export default function CategoryCard({ name }) {
  return (
    <View style={styles.card}>
      <View style={styles.box} />
      <Text style={styles.text}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    marginRight: 14,
  },
  box: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#f2f2f2",
    marginBottom: 6,
  },
  text: {
    fontSize: 12,
  },
});
