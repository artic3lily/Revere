import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { auth, db } from "../config/firebase";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import BottomNav from "../components/BottomNav";

export default function InboxScreen({ navigation }) {
  const { theme } = useTheme();
  const uid = auth.currentUser?.uid;

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "threads"),
      where("members", "array-contains", uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        
        // Fix missing index by sorting locally
        list.sort((a, b) => {
          const at = a.updatedAt?.toMillis?.() ?? 0;
          const bt = b.updatedAt?.toMillis?.() ?? 0;
          return bt - at; // descending
        });

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
    const otherUsername = item.memberUsernames?.[otherId] || "user";
    const otherAvatar = item.memberAvatars?.[otherId] || null;

    const unread = item.unread?.[uid] || 0;
    const isUnread = unread > 0;

    return (
      <Pressable
        onPress={() =>
          navigation.navigate("UserChat", {
            otherUserId: otherId,
            otherUsername,
          })
        }
        style={[styles.thread, { backgroundColor: theme.card, borderColor: theme.border }]}
      >
        {/* Avatar */}
        {otherAvatar ? (
          <Image source={{ uri: otherAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.placeholder, borderColor: theme.border }]}>
            <Feather name="user" size={18} color={theme.icon} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            @{otherUsername}
          </Text>
          <View style={styles.previewRow}>
            {isUnread && <View style={styles.unreadDot} />}
            <Text 
              style={[
                styles.preview, 
                { color: isUnread ? theme.text : theme.textSecondary },
                isUnread && { fontWeight: "900", opacity: 1 }
              ]} 
              numberOfLines={1}
            >
              {item.lastMessage || "Say hi 👋"}
            </Text>
          </View>
        </View>

        {unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unread > 99 ? "99+" : String(unread)}</Text>
          </View>
        )}

        <Feather name="chevron-right" size={18} color={theme.icon} style={{ opacity: 0.6 }} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={styles.topbar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.bg }]}>
          <Feather name="arrow-left" size={20} color={theme.icon} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Messages</Text>
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
            <Text style={[styles.empty, { color: theme.textSecondary }]}>No messages yet. Tap “Message” on a profile.</Text>
          }
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      <BottomNav navigation={navigation} />
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
    gap: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#111",
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
