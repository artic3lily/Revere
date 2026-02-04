import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
} from "react-native";

import CategoryCard from "../components/CategoryCard";
import ItemCard from "../components/ItemCard";
import BottomNav from "../components/BottomNav";
import { categories, items } from "../data/dummyData";

const menuImg = require("../../assets/images/menu.png");
const searchImg = require("../../assets/images/search.png");
const cartImg = require("../../assets/images/cart.png");

export default function HomeScreen() {
  // Banner dots + paging (4 slides)
  const bannerRef = useRef(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const { width } = Dimensions.get("window");
  const bannerWidth = width - 32; // paddingHorizontal 16 * 2

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable hitSlop={10}>
            <Image style={styles.icon} source={menuImg} />
          </Pressable>

          <Text style={styles.brand}>Revere</Text>

          <View style={styles.headerRight}>
            <Pressable hitSlop={10}>
              <Image style={styles.icon} source={searchImg} />
            </Pressable>
            <Pressable hitSlop={10} style={{ marginLeft: 12 }}>
              <Image style={styles.icon} source={cartImg} />
            </Pressable>
          </View>
        </View>

        {/* Categories */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
          <Pressable>
            <Text style={styles.link}>See all</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowList}
        >
          {categories.map((cat) => (
            <CategoryCard key={cat.id} name={cat.name} />
          ))}
        </ScrollView>

        {/* Banner (BIGGER + 4 dots swipe like Instagram) */}
        <View style={styles.bannerOuter}>
          <ScrollView
            ref={bannerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / bannerWidth);
              setBannerIndex(i);
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.banner, { width: bannerWidth }]}>
                <Text style={styles.bannerTitle}>New Drop</Text>
                <Text style={styles.bannerSub}>Fresh items added today</Text>

                <Pressable style={styles.bannerBtn}>
                  <Text style={styles.bannerBtnText}>Explore</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.dot, bannerIndex === i && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* Items (UNCHANGED) */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Trending</Text>
          <Pressable>
            <Text style={styles.link}>View more</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowList}
        >
          {items.map((item) => (
            <ItemCard key={item.id} title={item.title} price={item.price} />
          ))}
        </ScrollView>

        {/* Spacer so BottomNav never covers content */}
        <View style={{ height: 90 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },

  content: {
    paddingTop: 44,
    paddingHorizontal: 16,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  brand: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
    letterSpacing: 0.5,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  icon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
  },

  link: {
    fontSize: 12,
    color: "#111",
    textDecorationLine: "underline",
    fontWeight: "800",
  },

  rowList: {
    paddingRight: 8,
    paddingBottom: 8,
  },

  // Banner (carousel wrapper)
  bannerOuter: {
    marginTop: 16,
  },

  // Banner (single slide) — bigger like your reference
  banner: {
    borderRadius: 22,
    padding: 22,
    minHeight: 170,
    backgroundColor: "#f3f3f3",
  },

  bannerTitle: { fontSize: 22, fontWeight: "900", color: "#111" },
  bannerSub: { marginTop: 8, fontSize: 13, color: "#333", opacity: 0.85 },

  bannerBtn: {
    marginTop: 16,
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: "#111",
    backgroundColor: "#fff",
  },
  bannerBtnText: { fontSize: 13, fontWeight: "900", color: "#111" },

  // Dots
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: "#111",
    opacity: 0.18,
    marginHorizontal: 4,
  },
  dotActive: {
    opacity: 0.9,
    transform: [{ scale: 1.1 }],
  },
});
