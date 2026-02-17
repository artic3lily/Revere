import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { auth, db } from "../config/firebase";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

export default function InboxScreen({ navigation }) {
  const uid = auth.currentUser?.uid;

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "threads"),
      where("members", "array-contains", uid),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setThreads(list);
        setLoading(false);
      },
      (e) => {
        console.log("Inbox load error:", e?.code, e?.message || e);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  const renderItem = ({ item }) => {
    const otherId = item.members?.find((m) => m !== uid);
    const otherUsername =
      item.memberUsernames?.[otherId] || "user";

    const unread = item.unread?.[uid] || 0;

    return (
      <Pressable
        onPress={() =>
          navigation.navigate("UserChat", {
            otherUserId: otherId,
            otherUsername,
          })
        }
        style={styles.thread}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            @{otherUsername}
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessage || "Say hi 👋"}
          </Text>
        </View>

        {unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unread > 99 ? "99+" : String(unread)}</Text>
          </View>
        )}

        <Feather name="chevron-right" size={18} color="#111" style={{ opacity: 0.6 }} />
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Feather name="arrow-left" size={20} color="#111" />
        </Pressable>
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>No messages yet. Tap “Message” on a profile.</Text>
          }
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", paddingTop: 44, paddingHorizontal: 16 },
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { marginTop: 18, textAlign: "center", color: "#111", opacity: 0.55, fontWeight: "800" },

  thread: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  name: { fontSize: 13, fontWeight: "900", color: "#111" },
  preview: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#111", opacity: 0.65 },

  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "900" },
});
