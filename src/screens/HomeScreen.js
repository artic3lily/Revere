import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import CategoryCard from "../components/CategoryCard";
import ItemCard from "../components/ItemCard";
import BottomNav from "../components/BottomNav";
import { categories, items } from "../data/dummyData";

const menuImg = require("../../assets/images/menu.png");
const searchImg = require("../../assets/images/search.png");
const cartImg = require("../../assets/images/cart.png");

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image style={styles.menu} source={menuImg} />

          <View style={styles.headerIcons}>
            <Image style={styles.icon} source={searchImg} />
            <Image style={styles.icon} source={cartImg} />
          </View>
        </View>

        {/* Categories */}
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((cat) => (
            <CategoryCard key={cat.id} name={cat.name} />
          ))}
        </ScrollView>

        {/* Big Banner */}
        <View style={styles.banner} />

        {/* Items */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {items.map((item) => (
            <ItemCard
              key={item.id}
              title={item.title}
              price={item.price}
            />
          ))}
        </ScrollView>

      </ScrollView>

      {/* Bottom Nav */}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    alignItems: "center",
  },
  menu: {
    width: 28,
    height: 28,
    resizeMode: "contain",
    backgroundColor: "transparent", 
  },
  headerIcons: {
    flexDirection: "row",
  },
  icon: {
    width: 28,
    height: 28,
    marginLeft: 14,
    resizeMode: "contain",
    backgroundColor: "transparent", 
  },
});