import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { auth, db } from "../config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  increment,
} from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";

function threadIdFor(a, b) {
  return [a, b].sort().join("_");
}

export default function UserChatScreen({ navigation, route }) {
  const uid = auth.currentUser?.uid;
  const otherUserId = route?.params?.otherUserId;
  const otherUsername = route?.params?.otherUsername;

  const threadId = useMemo(() => {
    if (!uid || !otherUserId) return null;
    return threadIdFor(uid, otherUserId);
  }, [uid, otherUserId]);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);

  // Create / merge thread doc (top-level)
  const ensureThread = async () => {
    if (!uid || !otherUserId || !threadId) return;

    const meSnap = await getDoc(doc(db, "users", uid));
    const me = meSnap.exists() ? meSnap.data() : {};
    const myUsername = me?.username || auth.currentUser?.email?.split("@")[0] || "me";

    await setDoc(
      doc(db, "threads", threadId),
      {
        members: [uid, otherUserId],
        memberUsernames: {
          [uid]: myUsername,
          [otherUserId]: otherUsername || "user",
        },
        lastMessage: "",
        updatedAt: serverTimestamp(),
        unread: {
          [uid]: 0,
          [otherUserId]: 0,
        },
      },
      { merge: true }
    );
  };

  // Mark as read when opening chat
  const markRead = async () => {
    if (!uid || !threadId) return;
    try {
      await updateDoc(doc(db, "threads", threadId), {
        [`unread.${uid}`]: 0,
      });
    } catch (e) {
      // makign sure ki thread ma exists garxa
      try {
        await ensureThread();
        await updateDoc(doc(db, "threads", threadId), { [`unread.${uid}`]: 0 });
      } catch {}
    }
  };

  // Load messages realtime
  useEffect(() => {
    if (!threadId) return;

    // make sure thread exists + reset unread
    ensureThread().then(markRead);

    const q = query(
      collection(db, "threads", threadId, "messages"),
      orderBy("clientCreatedAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(list);

        // if any new messages, keep bottom view
        setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
      },
      (e) => console.log("Messages listener error:", e?.code, e?.message)
    );

    return () => unsub();
  }, [threadId]);

  // also mark read when screen comes back into focus
  useEffect(() => {
    if (!threadId) return;
    const unsub = navigation.addListener("focus", () => {
      markRead();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, threadId]);

  const send = async () => {
    if (!uid || !otherUserId || !threadId) return;
    const msg = text.trim();
    if (!msg || sending) return;

    setSending(true);
    setText("");

    try {
      await ensureThread();

      await addDoc(collection(db, "threads", threadId, "messages"), {
        text: msg,
        from: uid,
        to: otherUserId,
        createdAt: serverTimestamp(),
        clientCreatedAt: Date.now(),
      });

      // update thread meta + unread counts
      await updateDoc(doc(db, "threads", threadId), {
        lastMessage: msg,
        updatedAt: serverTimestamp(),
        // sender read stays 0
        [`unread.${uid}`]: 0,
        // receiver unread increments
        [`unread.${otherUserId}`]: increment(1),
      });
    } catch (e) {
      console.log("Send message error:", e?.code, e?.message || e);
      setText(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.topbar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
            <Feather name="arrow-left" size={20} color="#111" />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("UserProfile", { userId: otherUserId })}
            hitSlop={10}
          >
            <Text style={styles.title} numberOfLines={1}>
              @{otherUsername || "user"}
            </Text>
          </Pressable>

          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const mine = item.from === uid;
              return (
                <View style={[styles.bubble, mine ? styles.me : styles.them]}>
                  <Text style={styles.bubbleText}>{item.text}</Text>
                </View>
              );
            }}
          />

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={send}
            />
            <Pressable onPress={send} style={[styles.sendBtn, sending && { opacity: 0.6 }]}>
              <Text style={styles.sendText}>{sending ? "..." : "Send"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 12, paddingTop: 12 },

  topbar: {
    paddingTop: 34,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginBottom: 8,
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
  title: { fontSize: 14, fontWeight: "900", color: "#111", maxWidth: "70%" },

  bubble: {
    padding: 10,
    marginVertical: 4,
    maxWidth: "78%",
    borderRadius: 12,
  },
  me: { alignSelf: "flex-end", backgroundColor: "#E8D8FF" },
  them: { alignSelf: "flex-start", backgroundColor: "#F2F2F2" },
  bubbleText: { fontSize: 13, fontWeight: "800", color: "#111" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sendText: { color: "#fff", fontWeight: "900" },
});
