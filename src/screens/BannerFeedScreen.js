import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { useTheme } from "../context/ThemeContext";

export default function BannerFeedScreen({ route, navigation }) {
  const { bannerTitle } = route.params;
  const { theme, isDark } = useTheme();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wishlist, setWishlist] = useState(new Set());

  // Load wishlist
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDocs(collection(db, "users", uid, "wishlist")).then((snap) => {
      setWishlist(new Set(snap.docs.map((d) => d.id)));
    });
  }, []);

  // Load posts based on banner Title
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const postsRef = collection(db, "posts");
        let allDocs = new Map();

        if (bannerTitle === "Street Styles") {
          // Query 1: Category "Street Wear"
          const categoryQuery = query(
            postsRef,
            where("category", "==", "Street Wear"),
            limit(100)
          );

          // Query 2: Tags containing specific street style keywords
          const tagsQuery = query(
            postsRef,
            where("tags", "array-contains-any", ["streetstyle", "baggy", "streetwear", "urbanstyle", "cityfashion", "casualfit"]),
            limit(100)
          );

          try {
            const [catSnap, tagsSnap] = await Promise.all([
              getDocs(categoryQuery),
              getDocs(tagsQuery),
            ]);

            catSnap.forEach((d) => allDocs.set(d.id, { id: d.id, ...d.data() }));
            tagsSnap.forEach((d) => allDocs.set(d.id, { id: d.id, ...d.data() }));
          } catch (fetchErr) {
            // Fallback: If index fails or array-contains-any fails due to composite index
            console.log("BannerFeed querying error:", fetchErr);
            const fallbackQuery = query(postsRef, orderBy("createdAt", "desc"), limit(200));
            const fallbackSnap = await getDocs(fallbackQuery);
            fallbackSnap.forEach((d) => {
              const data = d.data();
              const hasCategory = data.category === "Street Wear";
              const tags = Array.isArray(data.tags) ? data.tags : [];
              const hasTag = tags.some((t) => ["streetstyle", "baggy", "streetwear", "urbanstyle", "cityfashion", "casualfit"].includes(t.toLowerCase()));
              if (hasCategory || hasTag) {
                allDocs.set(d.id, { id: d.id, ...data });
              }
            });
          }
        }

        // Sort by createdAt descending
        let list = Array.from(allDocs.values());
        list.sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? a.clientCreatedAt ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? b.clientCreatedAt ?? 0;
          return bt - at;
        });

        setPosts(list);
      } catch (err) {
        console.log("BannerFeedScreen error:", err?.message);
        setError(err?.message || "Something went wrong while fetching posts.");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [bannerTitle]);

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

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable
          hitSlop={12}
          style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {bannerTitle}
        </Text>

        {/* spacer */}
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color="#d32f2f" />
          <Text style={[styles.emptyText, { color: "#d32f2f" }]}>
            Unable to load feed.
          </Text>
          <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
            {error}
          </Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Feather name="wind" size={36} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No posts found for {bannerTitle}.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Post count pill */}
          <View style={[styles.countPill, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.countText, { color: theme.text }]}>
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </Text>
          </View>

          {/* Grid */}
          <View style={styles.gridWrap}>
            {posts.map((p) => (
              <View
                key={p.id}
                style={[styles.gridTile, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <Pressable
                  onPress={() => navigation.navigate("PostDetail", { postId: p.id })}
                >
                  <Image
                    source={{ uri: p.tryOnWhiteUrl || p.imageUrl }}
                    style={styles.gridImg}
                  />
                  <View style={[styles.gridMeta, { backgroundColor: theme.card }]}>
                    <Text numberOfLines={2} style={[styles.gridCaption, { color: theme.text }]}>
                      {p.caption}
                    </Text>
                    {p.price ? (
                      <Text style={[styles.gridPrice, { color: theme.textSecondary }]}>
                        Rs. {p.price}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                {/* Wishlist heart */}
                <View style={styles.heartWrap} pointerEvents="box-none">
                  <Pressable
                    style={[
                      styles.heartBtn,
                      {
                        backgroundColor: isDark
                          ? "rgba(0,0,0,0.6)"
                          : "rgba(255,255,255,0.9)",
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => toggleWishlist(p.id)}
                  >
                    <Feather
                      name="heart"
                      size={18}
                      color={wishlist.has(p.id) ? "red" : theme.icon}
                    />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },

  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },

  emptyText: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyHint: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    opacity: 0.7,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  countPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },

  countText: {
    fontSize: 12,
    fontWeight: "800",
  },

  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },

  gridTile: {
    width: "48%",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 8,
    position: "relative",
  },

  gridImg: {
    width: "100%",
    height: 160,
    backgroundColor: "#f2f2f2",
  },

  gridMeta: { padding: 10 },

  gridCaption: {
    fontSize: 13,
    fontWeight: "800",
  },

  gridPrice: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },

  heartWrap: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 3,
  },

  heartBtn: {
    width: 34,
    height: 34,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
