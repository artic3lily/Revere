import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { useTheme } from "../context/ThemeContext";

export default function RatingListScreen({ route, navigation }) {
  const { theme } = useTheme();
  
  // Params passed from Profile
  const { userId, title } = route.params || {};

  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let unsubList = null;
    (async () => {
      try {
        const listRef = collection(db, "ratings", userId, "users");
        
        unsubList = onSnapshot(listRef, async (snap) => {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          if (docs.length === 0) {
            setRatings([]);
            setLoading(false);
            return;
          }

          // Fetch full profile info for each rater ID
          try {
            const profiles = await Promise.all(
              docs.map(async (ratingDoc) => {
                const pSnap = await getDoc(doc(db, "users", ratingDoc.id));
                if (!pSnap.exists()) return null;
                return { 
                  id: pSnap.id, 
                  ...pSnap.data(),
                  stars: ratingDoc.stars || 0
                };
              })
            );
            
            setRatings(profiles.filter(Boolean));
          } catch (e) {
            console.log("RatingList profiles load error:", e);
          } finally {
            setLoading(false);
          }
        }, (e) => {
           console.log("RatingList listener error:", e);
           setLoading(false);
        });

      } catch (err) {
        console.log("RatingList Init Error", err);
        setLoading(false);
      }
    })();

    return () => {
      if (unsubList) unsubList();
    };
  }, [userId]);

  const TopBar = () => (
    <View style={[styles.topbar, { backgroundColor: theme.header, borderColor: theme.border }]}>
      <Pressable onPress={() => navigation.goBack()} style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.card }]} hitSlop={12}>
        <Feather name="arrow-left" size={20} color={theme.text} />
      </Pressable>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title || "Ratings"}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <TopBar />
        <View style={styles.loading}>
          <ActivityIndicator color={theme.text} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TopBar />

      {ratings.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={{ color: theme.textSecondary, fontWeight: "700" }}>
            No ratings yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={ratings}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          renderItem={({ item }) => (
            <Pressable 
              style={[styles.row, { borderBottomColor: theme.border }]} 
              onPress={() => navigation.navigate("UserProfile", { userId: item.id })}
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

              {/* Stars */}
              <View style={styles.starsWrap}>
                <Text style={[styles.starCount, { color: theme.text }]}>{item.stars}</Text>
                <Feather name="star" size={16} color={theme.text} />
              </View>
            </Pressable>
          )}
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
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPh: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
  },
  username: {
    fontSize: 13,
    marginTop: 2,
  },
  starsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  starCount: {
    fontSize: 14,
    fontWeight: "600",
  },
});
