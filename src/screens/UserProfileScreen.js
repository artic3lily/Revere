import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { auth, db } from "../config/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getCountFromServer,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

function formatJoined(ts) {
  try {
    if (!ts) return "Joined recently";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return `Joined ${d.toLocaleString(undefined, { month: "short", year: "numeric" })}`;
  } catch {
    return "Joined recently";
  }
}

export default function UserProfileScreen({ navigation, route }) {
  const currentUid = auth.currentUser?.uid;
  const userId = route?.params?.userId;

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [isFollowing, setIsFollowing] = useState(false);
  const [busyFollow, setBusyFollow] = useState(false);

  // detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const detailScrollRef = useRef(null);

  const { width } = Dimensions.get("window");
  const gridGap = 8;
  const tileSize = Math.floor((width - 16 * 2 - gridGap * 2) / 3);

  useEffect(() => {
    if (!userId) return;

    let unsubPosts = null;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", userId));
        if (!snap.exists()) {
          setProfile(null);
          setLoadingProfile(false);
          return;
        }
        setProfile(snap.data());

        // follow counts
        const [followersSnap, followingSnap] = await Promise.all([
          getCountFromServer(collection(db, "followers", userId, "users")),
          getCountFromServer(collection(db, "following", userId, "users")),
        ]);
        setFollowersCount(followersSnap.data().count);
        setFollowingCount(followingSnap.data().count);

        // check if maile follow gareko xu ki xaina
        if (currentUid) {
          const rel = await getDoc(doc(db, "followers", userId, "users", currentUid));
          setIsFollowing(rel.exists());
        }

        // posts
        const q = query(
          collection(db, "posts"),
          where("ownerId", "==", userId),
          orderBy("createdAt", "desc")
        );

        unsubPosts = onSnapshot(
          q,
          (snap2) => {
            const list = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
            setPosts(list);
            setLoadingPosts(false);
          },
          (err) => {
            console.log("Load posts error:", err?.message || err);
            setLoadingPosts(false);
          }
        );
      } catch (e) {
        Alert.alert("Error", e?.message ?? "Could not load user profile");
      } finally {
        setLoadingProfile(false);
      }
    })();

    return () => {
      if (unsubPosts) unsubPosts();
    };
  }, [userId, currentUid]);

  const toggleFollow = async () => {
    if (!currentUid || !userId) return;
    if (currentUid === userId) return;

    try {
      setBusyFollow(true);
      const batch = writeBatch(db);

      const followerDoc = doc(db, "followers", userId, "users", currentUid);
      const followingDoc = doc(db, "following", currentUid, "users", userId);

      if (isFollowing) {
        batch.delete(followerDoc);
        batch.delete(followingDoc);
      } else {
        batch.set(followerDoc, { createdAt: serverTimestamp() });
        batch.set(followingDoc, { createdAt: serverTimestamp() });
      }

      await batch.commit();

      // optimistic UI
      setIsFollowing((v) => !v);
      setFollowersCount((c) => (isFollowing ? Math.max(0, c - 1) : c + 1));
    } catch (e) {
      Alert.alert("Follow failed", e?.message ?? "Check Firestore rules");
    } finally {
      setBusyFollow(false);
    }
  };

  const openPost = (p) => {
    setActivePost(p);
    setDetailOpen(true);
    setTimeout(() => detailScrollRef.current?.scrollToOffset?.({ offset: 0, animated: false }), 0);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setActivePost(null);
  };

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

  if (loadingProfile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.screen}>
        <View style={styles.topbar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
            <Feather name="arrow-left" size={20} color="#111" />
          </Pressable>
          <Text style={styles.title}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.empty}>User not found.</Text>
      </View>
    );
  }

  const joinedText = formatJoined(profile?.createdAt);

  return (
    <View style={styles.screen}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Feather name="arrow-left" size={20} color="#111" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          @{profile?.username || "username"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        {profile?.photoURL ? (
          <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPh}>
            <Feather name="user" size={22} color="#111" />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {profile?.fullName || "User"}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{profile?.username || "username"}
          </Text>

          <Text style={styles.joined} numberOfLines={1}>
            {joinedText}
          </Text>

          <Text style={styles.about} numberOfLines={2}>
            {profile?.about?.trim()?.length ? profile.about : "No bio yet ✨"}
          </Text>
        </View>

        {/* Right-side actions */}
        {currentUid !== userId && (
          <View style={styles.actionStack}>
            {/* FOLLOW */}
            <Pressable
              onPress={toggleFollow}
              disabled={busyFollow}
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            >
              <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
                {busyFollow ? "..." : isFollowing ? "Following" : "Follow"}
              </Text>
            </Pressable>

            {/* MESSAGE */}
            <Pressable
              onPress={() =>
                navigation.navigate("UserChat", {
                  otherUserId: userId,
                  otherUsername: profile?.username,
                })
              }
              style={styles.messageBtn}
            >
              <Text style={styles.messageText}>Message</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* stats */}
      <View style={styles.followRow}>
        <View style={styles.followPill}>
          <Text style={styles.followNum}>{followingCount}</Text>
          <Text style={styles.followLbl}>Following</Text>
        </View>
        <View style={styles.followPill}>
          <Text style={styles.followNum}>{followersCount}</Text>
          <Text style={styles.followLbl}>Followers</Text>
        </View>
        <View style={styles.followPill}>
          <Text style={styles.followNum}>{posts.length}</Text>
          <Text style={styles.followLbl}>Posts</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Posts</Text>

      {loadingPosts ? (
        <View style={{ paddingTop: 20 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(it) => it.id}
          renderItem={renderTile}
          numColumns={3}
          columnWrapperStyle={{ gap: 8 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>No posts yet.</Text>}
        />
      )}

      {/* Post detail */}
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
            ref={detailScrollRef}
            data={[activePost].filter(Boolean)}
            keyExtractor={() => "only"}
            renderItem={() => (
              <View style={styles.detailCard}>
                <View style={styles.detailUserRow}>
                  {profile?.photoURL ? (
                    <Image source={{ uri: profile.photoURL }} style={styles.detailAvatar} />
                  ) : (
                    <View style={styles.detailAvatarPh}>
                      <Feather name="user" size={16} color="#111" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName} numberOfLines={1}>
                      {profile?.fullName || "User"}
                    </Text>
                    <Text style={styles.detailUsername} numberOfLines={1}>
                      @{profile?.username || "username"}
                    </Text>
                  </View>
                </View>

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
  title: { fontSize: 16, fontWeight: "900", color: "#111", maxWidth: "80%" },

  profileCard: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#fff",
    alignItems: "flex-start",
  },
  avatar: { width: 72, height: 72, borderRadius: 18 },
  avatarPh: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },

  name: { fontSize: 16, fontWeight: "900", color: "#111" },
  username: { marginTop: 2, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.65 },
  joined: { marginTop: 6, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.75 },
  about: { marginTop: 8, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.85 },

  //Follow + Message stack
  actionStack: {
    gap: 8,
    alignItems: "stretch",
  },

  followBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#111",
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 96,
  },
  followBtnActive: { backgroundColor: "#fff", borderColor: "#111" },
  followText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  followTextActive: { color: "#111" },

  messageBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 96,
  },
  messageText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#111",
  },

  followRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  followPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  followNum: { fontSize: 14, fontWeight: "900", color: "#111" },
  followLbl: { marginTop: 2, fontSize: 11, fontWeight: "800", color: "#111", opacity: 0.6 },

  sectionTitle: { marginTop: 16, marginBottom: 10, fontSize: 14, fontWeight: "900", color: "#111" },
  empty: { marginTop: 18, textAlign: "center", color: "#111", opacity: 0.55, fontWeight: "800" },

  tile: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f2f2f2",
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

  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },

  // detail
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
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: "#eee" },
  pillText: { fontSize: 12, fontWeight: "900", color: "#111", opacity: 0.75 },
  pillDark: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#111" },
  pillDarkText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  detailCaption: { marginTop: 12, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.9 },
  tagsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: { borderWidth: 1, borderColor: "#eee", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  tagChipText: { fontSize: 12, fontWeight: "900", color: "#111", opacity: 0.7 },
  tagsEmpty: { marginTop: 10, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.5 },
});
