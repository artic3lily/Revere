import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../config/firebase";
import { useTheme } from "../context/ThemeContext";

export default function FollowListScreen({ route, navigation }) {
  const { theme } = useTheme();
  const currentUid = auth.currentUser?.uid;
  
  // Params passed from Profile
  const { userId, title, type } = route.params || {};

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Set of UIDs that the current authenticated user is following
  // We need this to quickly render "Follow" vs "Following" buttons next to each name
  const [myFollowingSet, setMyFollowingSet] = useState(new Set());
  const [loadingMyFollowing, setLoadingMyFollowing] = useState(true);
  const [busyFollowId, setBusyFollowId] = useState(null);

  useEffect(() => {
    if (!currentUid) {
      setLoadingMyFollowing(false);
      return;
    }
    // Listen to current user's following list to keep UI instantly synced
    const q = query(collection(db, "following", currentUid, "users"));
    const unsub = onSnapshot(q, (snap) => {
      const followingIds = new Set(snap.docs.map((d) => d.id));
      setMyFollowingSet(followingIds);
      setLoadingMyFollowing(false);
    }, (e) => {
      console.log("My following map error", e);
      setLoadingMyFollowing(false);
    });

    return unsub;
  }, [currentUid]);

  useEffect(() => {
    if (!userId || !type) {
      setLoading(false);
      return;
    }

    let unsubList = null;
    (async () => {
      try {
        // 'type' is either "followers" or "following"
        const listRef = collection(db, type, userId, "users");
        
        unsubList = onSnapshot(listRef, async (snap) => {
          const ids = snap.docs.map(d => d.id);
          console.log(`FollowList query return [${type}]:`, ids);
          
          if (ids.length === 0) {
            setUsers([]);
            setLoading(false);
            return;
          }

          // Fetch full profile info for each ID
          try {
            const profiles = await Promise.all(
              ids.map(async (id) => {
                const pSnap = await getDoc(doc(db, "users", id));
                if (!pSnap.exists()) return null;
                return { id: pSnap.id, ...pSnap.data() };
              })
            );
            
            console.log("FollowList profiles loaded count:", profiles?.length);
            setUsers(profiles.filter(Boolean));
          } catch (e) {
            console.log("FollowList profiles load error:", e);
          } finally {
            setLoading(false);
          }
        }, (e) => {
           console.log("FollowList listener error:", e);
           setLoading(false);
        });

      } catch (err) {
        console.log("FollowList Init Error", err);
        setLoading(false);
      }
    })();

    return () => {
      if (unsubList) unsubList();
    };
  }, [userId, type]);


  const toggleFollow = async (targetUserId) => {
    if (!currentUid) return Alert.alert("You must be logged in to follow users.");
    if (currentUid === targetUserId) return;

    try {
      setBusyFollowId(targetUserId);
      const isFollowing = myFollowingSet.has(targetUserId);

      const batch = writeBatch(db);
      const followerDoc = doc(db, "followers", targetUserId, "users", currentUid);
      const followingDoc = doc(db, "following", currentUid, "users", targetUserId);

      if (isFollowing) {
        batch.delete(followerDoc);
        batch.delete(followingDoc);
      } else {
        batch.set(followerDoc, { createdAt: serverTimestamp() });
        batch.set(followingDoc, { createdAt: serverTimestamp() });
      }

      await batch.commit();

      // UI updates automatically via myFollowingSet onSnapshot
    } catch (e) {
      Alert.alert("Follow failed", e?.message ?? "Check Firestore rules");
    } finally {
      setBusyFollowId(null);
    }
  };

  const TopBar = () => (
    <View style={[styles.topbar, { backgroundColor: theme.header, borderColor: theme.border }]}>
      <Pressable onPress={() => navigation.goBack()} style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.card }]} hitSlop={12}>
        <Feather name="arrow-left" size={20} color={theme.text} />
      </Pressable>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title || "Users"}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading || loadingMyFollowing) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <TopBar />
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TopBar />

      {users.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={{ color: theme.textSecondary, fontWeight: "700" }}>
            No users to show.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          renderItem={({ item }) => {
            const isMe = item.id === currentUid;
            const amIFollowing = myFollowingSet.has(item.id);
            const isBusy = busyFollowId === item.id;

            return (
              <Pressable 
                style={[styles.row, { borderBottomColor: theme.border }]} 
                onPress={() => {
                  if (isMe) {
                    navigation.navigate("Profile");
                  } else {
                    navigation.navigate("UserProfile", { userId: item.id });
                  }
                }}
              >
                {/* Avatar */}
                {item.photoURL ? (
                  <Image source={{ uri: item.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPh, { borderColor: theme.border, backgroundColor: theme.placeholder }]}>
                    <Feather name="user" size={20} color={theme.text} />
                  </View>
                )}

                {/* Name & Username */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {item.fullName || item.username || "User"}
                  </Text>
                  <Text style={[styles.username, { color: theme.textSecondary }]} numberOfLines={1}>
                    @{item.username || "username"}
                  </Text>
                </View>

                {/* Optional Follow Button */}
                {!isMe && (
                  <Pressable
                    style={[
                      styles.followBtn,
                      {
                        backgroundColor: amIFollowing ? theme.card : theme.text,
                        borderColor: amIFollowing ? theme.border : theme.text,
                      }
                    ]}
                    onPress={() => toggleFollow(item.id)}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                       <ActivityIndicator size="small" color={amIFollowing ? theme.text : theme.bg} />
                    ) : (
                       <Text style={[
                         styles.followBtnText,
                         { color: amIFollowing ? theme.text : theme.bg }
                       ]}>
                         {amIFollowing ? "Following" : "Follow"}
                       </Text>
                    )}
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "800", maxWidth: "70%" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarPh: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 15, fontWeight: "500" },
  username: { marginTop: 1, fontSize: 14, fontWeight: "400" },

  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: "800",
  }
});
