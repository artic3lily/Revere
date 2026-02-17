import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { auth, db } from "../config/firebase";
import {
  collection,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

const CATEGORIES = ["All", "Grunge", "Casual", "Elegant", "Chic", "Y2k"];

function normalizeTerm(s) {
  return (s || "").trim().toLowerCase();
}

export default function SearchScreen({ navigation }) {
  const uid = auth.currentUser?.uid;

  const [tab, setTab] = useState("people"); // people, posts
  const [term, setTerm] = useState("");

  // posts filters
  const [category, setCategory] = useState("All");
  const [tag, setTag] = useState(""); // single tag input

  // results
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState([]);
  const [posts, setPosts] = useState([]);

  // Post detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [owner, setOwner] = useState(null);

  const { width } = Dimensions.get("window");
  const gridGap = 8;
  const tileSize = Math.floor((width - 16 * 2 - gridGap * 2) / 3);

  // search people
  const searchPeople = async () => {
    const qTerm = normalizeTerm(term);
    if (!qTerm) {
      setPeople([]);
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, "users");

      const usernameQ = query(
        usersRef,
        orderBy("username"),
        where("username", ">=", term.trim().toLowerCase()),
        where("username", "<=", term.trim().toLowerCase() + "\uf8ff"),
        limit(15)
      );

      const fullNameQ = query(
        usersRef,
        orderBy("fullName"),
        where("fullName", ">=", term.trim()),
        where("fullName", "<=", term.trim() + "\uf8ff"),
        limit(15)
      );

      const [uSnap, nSnap] = await Promise.all([getDocs(usernameQ), getDocs(fullNameQ)]);

      const map = new Map();
      uSnap.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
      nSnap.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));

      // remove current user from results
      const list = Array.from(map.values()).filter((x) => x.id !== uid);

      // small sorting, usernames that start with term first
      list.sort((a, b) => {
        const au = (a.username || "").toLowerCase();
        const bu = (b.username || "").toLowerCase();
        const aStarts = au.startsWith(qTerm) ? 0 : 1;
        const bStarts = bu.startsWith(qTerm) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return au.localeCompare(bu);
      });

      setPeople(list);
    } catch (e) {
      // if index required, firestore created link once
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  // posts search
  const searchPosts = async () => {
    const qTerm = normalizeTerm(term);
    const t = normalizeTerm(tag);

    // posts search: uses category and or tag
    setLoading(true);
    try {
      const postsRef = collection(db, "posts");

      let qArr = [];

      if (category !== "All" && t) {
        // category + tag: fetch category posts, filter client-side for partial tag match
        qArr.push(
          query(
            postsRef,
            where("category", "==", category),
            limit(150)
          )
        );
      } else if (category !== "All") {
        // category only
        qArr.push(
          query(
            postsRef,
            where("category", "==", category),
            limit(100)
          )
        );
      } else if (t) {
        // tag only: fetch recent posts, filter client-side for partial tag match
        qArr.push(
          query(
            postsRef,
            orderBy("createdAt", "desc"),
            limit(150)
          )
        );
      } else if (qTerm) {
        // if user typed something in search bar but no filters,
        // show newest posts 
        qArr.push(query(postsRef, orderBy("createdAt", "desc"), limit(60)));
      } else {
        setPosts([]);
        setLoading(false);
        return;
      }

      const snaps = await Promise.all(qArr.map((qq) => getDocs(qq)));
      const map = new Map();
      snaps.forEach((s) => s.forEach((d) => map.set(d.id, { id: d.id, ...d.data() })));

      let list = Array.from(map.values());

      // if term exists, filter by caption/ownerUsername client-side
      if (qTerm) {
        list = list.filter((p) => {
          const cap = normalizeTerm(p.caption);
          const u = normalizeTerm(p.ownerUsername);
          const nm = normalizeTerm(p.ownerName);
          return cap.includes(qTerm) || u.includes(qTerm) || nm.includes(qTerm);
        });
      }

      if (t) {
        list = list.filter((p) => {
          const tags = Array.isArray(p?.tags) ? p.tags : [];
          return tags.some((tag) => tag.includes(t));
        });
      }

      // sort by createdAt fallback to clientCreatedAt
      list.sort((a, b) => {
        const at = a.createdAt?.toMillis?.() ?? a.clientCreatedAt ?? 0;
        const bt = b.createdAt?.toMillis?.() ?? b.clientCreatedAt ?? 0;
        return bt - at;
      });

      setPosts(list);
    } catch (e) {
      console.log("Search error:", e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // run search on change
  useEffect(() => {
    const tmr = setTimeout(() => {
      if (tab === "people") searchPeople();
      else searchPosts();
    }, 250);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, tab, category, tag]);

  const openUser = (u) => {
    navigation.navigate("UserProfile", { userId: u.id });
  };

  const openPost = async (p) => {
    setActivePost(p);
    setOwner(null);
    setDetailOpen(true);

    try {
      if (p?.ownerId) {
        const s = await getDoc(doc(db, "users", p.ownerId));
        if (s.exists()) setOwner({ id: s.id, ...s.data() });
      }
    } catch {
      // ignore
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setActivePost(null);
    setOwner(null);
  };

  const renderPerson = ({ item }) => (
    <Pressable onPress={() => openUser(item)} style={styles.personRow}>
      {item.photoURL ? (
        <Image source={{ uri: item.photoURL }} style={styles.personAvatar} />
      ) : (
        <View style={styles.personAvatarPh}>
          <Feather name="user" size={16} color="#111" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.personName} numberOfLines={1}>
          {item.fullName || "User"}
        </Text>
        <Text style={styles.personUsername} numberOfLines={1}>
          @{item.username || "username"}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color="#111" style={{ opacity: 0.5 }} />
    </Pressable>
  );

  const renderTile = ({ item }) => (
    <Pressable
      onPress={() => openPost(item)}
      style={[styles.tile, { width: tileSize, height: tileSize }]}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.tileImg} />
      {typeof item.price === "number" && (
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>Rs. {item.price}</Text>
        </View>
      )}
    </Pressable>
  );

  const detailOwner = owner || {
    photoURL: activePost?.ownerPhotoURL || "",
    fullName: activePost?.ownerName || "User",
    username: activePost?.ownerUsername || "username",
  };

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Feather name="arrow-left" size={20} color="#111" />
        </Pressable>
        <Text style={styles.title}>Search</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search input */}
      <View style={styles.searchBox}>
        <Feather name="search" size={16} color="#111" style={{ opacity: 0.6 }} />
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder={tab === "people" ? "Search username or name..." : "Search posts (caption/user)..."}
          placeholderTextColor="#444"
          style={styles.searchInput}
        />
        {!!term && (
          <Pressable onPress={() => setTerm("")} hitSlop={10}>
            <Feather name="x" size={18} color="#111" style={{ opacity: 0.6 }} />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setTab("people")}
          style={[styles.tab, tab === "people" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "people" && styles.tabTextActive]}>
            People
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("posts")}
          style={[styles.tab, tab === "posts" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "posts" && styles.tabTextActive]}>
            Posts
          </Text>
        </Pressable>
      </View>

      {/* Filters for posts */}
      {tab === "posts" && (
        <View style={styles.filtersCard}>
          <Text style={styles.filterTitle}>Filters</Text>

          <Text style={styles.smallLabel}>Category</Text>
          <View style={styles.chipsRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, category === c && styles.chipActive]}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.smallLabel}>Tag</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              value={tag}
              onChangeText={setTag}
              placeholder="e.g. denim, y2k, black"
              placeholderTextColor="#444"
              style={styles.tagInput}
            />
            {!!tag && (
              <Pressable onPress={() => setTag("")} hitSlop={10} style={styles.tagClear}>
                <Feather name="x" size={16} color="#111" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View style={{ paddingTop: 20 }}>
          <ActivityIndicator />
        </View>
      ) : tab === "people" ? (
        <FlatList
          data={people}
          keyExtractor={(it) => it.id}
          renderItem={renderPerson}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {term.trim() ? "No people found." : "Type a name or username to search."}
            </Text>
          }
        />
      ) : (
        <FlatList
          key={`posts-3`}
          data={posts}
          keyExtractor={(it) => it.id}
          renderItem={renderTile}
          numColumns={3}
          columnWrapperStyle={{ gap: 8 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {(term.trim() || tag.trim() || category !== "All")
                ? "No posts match your search."
                : "Search posts by category or tags ✨"}
            </Text>
          }
        />
      )}

      {/* Post detail modal */}
      <Modal visible={detailOpen} animationType="slide">
        <View style={styles.detailScreen}>
          <View style={styles.detailTopbar}>
            <Pressable onPress={closeDetail} hitSlop={12} style={styles.iconBtn}>
              <Feather name="arrow-left" size={20} color="#111" />
            </Pressable>
            <Text style={styles.detailTitle}>Item</Text>
            <View style={{ width: 40 }} />
          </View>

          <FlatList
            data={[activePost].filter(Boolean)}
            keyExtractor={() => "only"}
            renderItem={() => (
              <View style={styles.detailCard}>
                <Pressable
                  style={styles.detailUserRow}
                  onPress={() => {
                    if (activePost?.ownerId) {
                      closeDetail();
                      navigation.navigate("UserProfile", { userId: activePost.ownerId });
                    }
                  }}
                >
                  {detailOwner?.photoURL ? (
                    <Image source={{ uri: detailOwner.photoURL }} style={styles.detailAvatar} />
                  ) : (
                    <View style={styles.detailAvatarPh}>
                      <Feather name="user" size={16} color="#111" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName} numberOfLines={1}>
                      {detailOwner?.fullName || "User"}
                    </Text>
                    <Text style={styles.detailUsername} numberOfLines={1}>
                      @{detailOwner?.username || "username"}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#111" style={{ opacity: 0.4 }} />
                </Pressable>

                <View style={styles.detailImgWrap}>
                  <Image source={{ uri: activePost?.imageUrl }} style={styles.detailImg} />
                </View>

                <View style={styles.detailMeta}>
                  <View style={styles.detailPillsRow}>
                    {typeof activePost?.price === "number" && (
                      <View style={styles.pillDark}>
                        <Text style={styles.pillDarkText}>Rs. {activePost.price}</Text>
                      </View>
                    )}
                    {!!activePost?.category && (
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{activePost.category}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.detailCaption}>
                    {activePost?.caption?.trim()?.length ? activePost.caption : "No caption"}
                  </Text>

                  {Array.isArray(activePost?.tags) && activePost.tags.length > 0 ? (
                    <View style={styles.tagsRow}>
                      {activePost.tags.slice(0, 12).map((t) => (
                        <View key={t} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>#{t}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.tagsEmpty}>No tags</Text>
                  )}
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 44 },

  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: { fontSize: 16, fontWeight: "900", color: "#111" },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: "800", color: "#111" },

  tabsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  tabActive: { borderColor: "#111" },
  tabText: { fontSize: 13, fontWeight: "900", color: "#111", opacity: 0.65 },
  tabTextActive: { opacity: 1 },

  filtersCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#fff",
  },
  filterTitle: { fontSize: 13, fontWeight: "900", color: "#111" },
  smallLabel: { marginTop: 10, fontSize: 12, fontWeight: "900", color: "#111", opacity: 0.8 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },
  chipActive: { borderColor: "#111" },
  chipText: { fontSize: 12, fontWeight: "900", color: "#111", opacity: 0.75 },
  chipTextActive: { opacity: 1 },

  tagInputRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  tagInput: { flex: 1, paddingVertical: 10, fontSize: 12, fontWeight: "800", color: "#111" },
  tagClear: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },

  personRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#fff",
  },
  personAvatar: { width: 42, height: 42, borderRadius: 16 },
  personAvatarPh: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  personName: { fontSize: 13, fontWeight: "900", color: "#111" },
  personUsername: { marginTop: 2, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.6 },

  empty: { marginTop: 18, textAlign: "center", color: "#111", opacity: 0.55, fontWeight: "800" },

  // grid
  tile: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f2f2f2",
    marginTop: 10,
  },
  tileImg: { width: "100%", height: "100%" },
  priceBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  priceBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },

  // detail modal
  detailScreen: { flex: 1, backgroundColor: "#fff" },
  detailTopbar: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailTitle: { fontSize: 14, fontWeight: "900", color: "#111" },

  detailCard: { padding: 16 },
  detailUserRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  detailAvatar: { width: 38, height: 38, borderRadius: 14 },
  detailAvatarPh: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  detailName: { fontSize: 13, fontWeight: "900", color: "#111" },
  detailUsername: { marginTop: 2, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.6 },

  detailImgWrap: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f2f2f2",
  },
  detailImg: { width: "100%", height: 320, resizeMode: "cover" },

  detailMeta: { marginTop: 12 },
  detailPillsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },
  pillText: { fontSize: 12, fontWeight: "900", color: "#111", opacity: 0.75 },
  pillDark: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#111" },
  pillDarkText: { fontSize: 12, fontWeight: "900", color: "#fff" },

  detailCaption: { marginTop: 12, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.9 },

  tagsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tagChipText: { fontSize: 12, fontWeight: "900", color: "#111", opacity: 0.7 },
  tagsEmpty: { marginTop: 10, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.5 },
});
