import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
  Modal,
  Alert,
  TouchableWithoutFeedback,
} from "react-native";
import { signOut } from "firebase/auth";
import { auth, db } from "../config/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

import CategoryCard from "../components/CategoryCard";
import ItemCard from "../components/ItemCard";
import BottomNav from "../components/BottomNav";
import { categories, items } from "../data/dummyData";

const menuImg = require("../../assets/images/menu.png");
const searchImg = require("../../assets/images/search.png");
const cartImg = require("../../assets/images/cart.png");

function formatJoined(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return `Joined ${d.toLocaleString(undefined, { month: "short", year: "numeric" })}`;
  } catch {
    return "Joined recently";
  }
}

const bannerImages = [
  {
    id: 0,
    image: { uri: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=900" },
    title: "New Drop",
    sub: "Fresh items added today",
  },
  {
    id: 1,
    image: { uri: "https://images.unsplash.com/photo-1521334884684-d80222895322?w=900" },
    title: "Street Styles",
    sub: "Trending this week",
  },
  {
    id: 2,
    image: { uri: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900" },
    title: "Vintage Picks",
    sub: "Retro never dies",
  },
  {
    id: 3,
    image: { uri: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900" },
    title: "Minimal Fits",
    sub: "Clean. Simple. You.",
  },
];

export default function HomeScreen({ navigation }) {
  const { theme, isDark, toggleTheme } = useTheme();

  const bannerRef = useRef(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const { width } = Dimensions.get("window");
  const bannerWidth = width - 32;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [wishlist, setWishlist] = useState(new Set());

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(60));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingPosts(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadWishlist = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const snap = await getDocs(collection(db, "users", uid, "wishlist"));
      setWishlist(new Set(snap.docs.map((d) => d.id)));
    };
    loadWishlist();
  }, []);

  const toggleWishlist = async (postId) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const next = new Set(wishlist);
    const exists = next.has(postId);
    exists ? next.delete(postId) : next.add(postId);
    setWishlist(next);

    const ref = doc(db, "users", uid, "wishlist", postId);
    exists ? await deleteDoc(ref) : await setDoc(ref, { createdAt: serverTimestamp() });
  };

  const confirmLogout = () => {
    Alert.alert("Logout?", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          setDrawerOpen(false);
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          {/* LEFT: Sidebar menu */}
          <Pressable hitSlop={10} onPress={() => setDrawerOpen(true)}>
            <Image style={[styles.icon, { tintColor: theme.icon }]} source={menuImg} />
          </Pressable>

          {/* revere */}
          <Text style={[styles.brand, { color: theme.text }]}>
            𝓡𝓮𝓿𝓮𝓻𝓮
          </Text>

          {/* Search + Chatbot */}
          <View style={styles.headerRight}>
            <Pressable hitSlop={10} onPress={() => navigation.navigate("Search")}>
              <Image style={[styles.icon, { tintColor: theme.icon }]} source={searchImg} />
            </Pressable>

            <Pressable
              hitSlop={10}
              style={{ marginLeft: 12 }}
              onPress={() => navigation.navigate("Chatbot")}
            >
              <Feather name="message-circle" size={22} color={theme.icon} />
            </Pressable>
          </View>
        </View>


        {/* Categories */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Shop by Category</Text>
          <Pressable>
            <Text style={[styles.link, { color: theme.text }]}>See all</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowList}
        >
          {categories.map((cat) => (
            <CategoryCard key={cat.id} name={cat.name} image={cat.image} />
          ))}
        </ScrollView>

        {/* Banner */}
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
            {bannerImages.map((b) => (
              <View key={b.id} style={[styles.banner, { width: bannerWidth }]}>
                <Image source={b.image} style={styles.bannerImage} />

                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerTitle}>{b.title}</Text>
                  <Text style={styles.bannerSub}>{b.sub}</Text>

                  <Pressable style={styles.bannerBtn}>
                    <Text style={styles.bannerBtnText}>Explore</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.dotsRow}>
            {bannerImages.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, bannerIndex === i && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* Items (UNCHANGED) */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Trending</Text>
          <Pressable>
            <Text style={[styles.link, { color: theme.text }]}>View more</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowList}
        >
          {items.map((item) => (
            <ItemCard
              key={item.id}
              image={item.image}
              title={item.title}
              price={item.price}
            />
          ))}
        </ScrollView>
        {/* Latest posts grid */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Latest</Text>
          <Pressable>
            <Text style={[styles.link, { color: theme.text }]}>See all</Text>
          </Pressable>
        </View>

        {loadingPosts ? (
          <Text style={{ marginVertical: 12, color: theme.textSecondary }}>Loading posts...</Text>
        ) : posts.length === 0 ? (
          <Text style={{ marginVertical: 12, color: theme.textSecondary }}>No posts yet.</Text>
        ) : (
          <View style={styles.gridWrap}>
            {posts.map((p) => (
              <View key={p.id} style={[styles.gridTile, { position: 'relative', backgroundColor: theme.card, borderColor: theme.border }]}>
                <Pressable
                  onPress={() => navigation.navigate('PostDetail', { postId: p.id })}
                >
                  <Image source={{ uri: p.imageUrl }} style={styles.gridImg} />
                  <View style={[styles.gridMeta, { backgroundColor: theme.card }]}>
                    <Text numberOfLines={2} style={[styles.gridCaption, { color: theme.text }]}>{p.caption}</Text>
                    <Text style={[styles.gridPrice, { color: theme.textSecondary }]}>${p.price ?? ''}</Text>
                  </View>
                </Pressable>

                <View style={styles.heartWrap} pointerEvents="box-none">
                  <Pressable style={[styles.heartBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)', borderColor: theme.border }]} onPress={() => toggleWishlist(p.id)}>
                    <Feather name="heart" size={18} color={wishlist.has(p.id) ? 'red' : theme.icon} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Drawer Modal */}
      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setDrawerOpen(false)}>
          <View style={styles.drawerBackdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.drawerPanel, { backgroundColor: theme.header, borderColor: theme.border }]}>
          <Text style={[styles.drawerTitle, { color: theme.text }]}>Menu</Text>

          {/* User Info */}
          <View style={[styles.drawerUserBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.drawerEmail, { color: theme.text }]}>{auth.currentUser?.email || 'No email'}</Text>
            <Text style={[styles.drawerSmall, { color: theme.textSecondary }]}>{formatJoined(new Date())}</Text>
          </View>

          {/* Theme Toggle */}
          <Text style={[styles.drawerSmall, { marginBottom: 8, fontWeight: '900', color: theme.text }]}>Theme</Text>
          <View style={styles.themeRow}>
            <Pressable 
              style={[styles.themeBtn, !isDark && styles.themeBtnActive, { borderColor: theme.border }]}
              onPress={() => isDark && toggleTheme()}
            >
              <Feather name="sun" size={18} color={!isDark ? theme.buttonText : theme.textSecondary} />
              <Text style={[styles.themeBtnText, !isDark && styles.themeBtnTextActive, { color: !isDark ? '#fff' : theme.textSecondary }]}>Light</Text>
            </Pressable>
            <Pressable 
              style={[styles.themeBtn, isDark && styles.themeBtnActive, { borderColor: theme.border }]}
              onPress={() => !isDark && toggleTheme()}
            >
              <Feather name="moon" size={18} color={isDark ? theme.buttonText : theme.textSecondary} />
              <Text style={[styles.themeBtnText, isDark && styles.themeBtnTextActive, { color: isDark ? '#fff' : theme.textSecondary }]}>Dark</Text>
            </Pressable>
          </View>

          {/* Logout Button */}
          <Pressable style={[styles.drawerBtn, styles.drawerBtnDanger, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={confirmLogout}>
            <Text style={[styles.drawerBtnText, { color: '#d32f2f' }]}>Logout</Text>
          </Pressable>

          <Text style={[styles.drawerFooter, { color: theme.textSecondary }]}>Revere © 2026</Text>
        </View>
      </Modal>

      <BottomNav navigation={navigation} />
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

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  brand: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
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

  // Banner
  bannerOuter: { marginTop: 16 },

  banner: {
    borderRadius: 22,
    minHeight: 170,
    backgroundColor: "#f3f3f3",
    overflow: "hidden",
  },

  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  bannerOverlay: {
    flex: 1,
    padding: 22,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.22)",
  },

  bannerTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  bannerSub: { marginTop: 8, fontSize: 13, color: "#fff", opacity: 0.9 },

  bannerBtn: {
    marginTop: 16,
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  bannerBtnText: { fontSize: 13, fontWeight: "900", color: "#fff" },

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

  // Grid
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  gridTile: {
    width: '48%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  gridImg: { width: '100%', height: 160, backgroundColor: '#f2f2f2' },
  gridMeta: { padding: 10 },
  gridCaption: { fontSize: 13, fontWeight: '800', color: '#111' },
  gridPrice: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#444' },
  heartWrap: { position: 'absolute', top: 8, right: 8, zIndex: 3 },
  heartBtn: { width: 34, height: 34, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderWidth:1, borderColor:'#eee' },

  // Detail modal styles
  detailScreen: { flex: 1, backgroundColor: '#fff' },
  detailTopbar: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  detailTitle: { fontSize: 14, fontWeight: '900', color: '#111' },
  detailUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  detailAvatar: { width: 38, height: 38, borderRadius: 14 },
  detailAvatarPh: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f2f2f2', alignItems: 'center', justifyContent: 'center', borderWidth:1, borderColor:'#eee' },
  detailName: { fontSize: 13, fontWeight: '900', color: '#111' },
  detailUsername: { marginTop: 2, fontSize: 12, fontWeight: '800', color: '#111', opacity: 0.6 },
  tagChip: { borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginRight:8, marginBottom:8 },
  tagChipText: { fontSize: 12, fontWeight: '900', color: '#111', opacity: 0.7 },

  // Drawer
  drawerBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  drawerPanel: {
    width: "72%", // ~half-ish drawer
    height: "100%",
    backgroundColor: "#fff",
    paddingTop: 54,
    paddingHorizontal: 16,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderWidth: 1,
    borderColor: "#eee",
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111",
    marginBottom: 12,
  },
  drawerUserBox: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 14,
  },
  drawerEmail: {
    fontSize: 12,
    fontWeight: "900",
    color: "#111",
  },
  drawerSmall: {
    marginTop: 6,
    fontSize: 12,
    color: "#111",
    opacity: 0.65,
    fontWeight: "700",
  },
  drawerBtn: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  drawerBtnDanger: {
    borderColor: "#111",
  },
  drawerBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111",
    textAlign: "center",
  },
  drawerFooter: {
    marginBottom: 20,
    fontSize: 11,
    color: "#111",
    opacity: 0.5,
    textAlign: "center",
    fontWeight: "700",
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  themeBtnActive: {
    backgroundColor: '#111',
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  themeBtnTextActive: {
    color: '#fff',
    fontWeight: '900',
  },
});
