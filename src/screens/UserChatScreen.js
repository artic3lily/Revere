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
  Image,
  Modal,
  TouchableWithoutFeedback,
  Alert
} from "react-native";
import { useTheme } from "../context/ThemeContext";
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
  const { theme, isDark } = useTheme();
  const uid = auth.currentUser?.uid;
  const otherUserId = route?.params?.otherUserId;
  const otherUsername = route?.params?.otherUsername;

  const [otherUser, setOtherUser] = useState(null);

  // Fetch the other user's info for avatar display
  useEffect(() => {
    if (!otherUserId) return;
    getDoc(doc(db, "users", otherUserId)).then((s) => {
      if (s.exists()) setOtherUser(s.data());
    });
  }, [otherUserId]);

  const threadId = useMemo(() => {
    if (!uid || !otherUserId) return null;
    return threadIdFor(uid, otherUserId);
  }, [uid, otherUserId]);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  
  // Track the read status of messages dynamically
  const [lastMessageReadByThem, setLastMessageReadByThem] = useState(false);

  // Deletion states
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [isDeletingMode, setIsDeletingMode] = useState(false);

  const listRef = useRef(null);

  // Create / merge thread doc (top-level)
  const ensureThread = async () => {
    if (!uid || !otherUserId || !threadId) return;

    // Do not overwrite thread if it already exists, as it will zero out unread messages!
    const snap = await getDoc(doc(db, "threads", threadId));
    if (snap.exists()) return;

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
        memberAvatars: {
           [uid]: me?.photoURL || "",
           [otherUserId]: otherUser?.photoURL || "",
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

    let unsub = null;

    // make sure thread exists before querying to avoid permission denial on non-existent thread doc
    ensureThread().then(() => {
      markRead();

      const q = query(
        collection(db, "threads", threadId, "messages"),
        orderBy("clientCreatedAt", "asc")
      );

      unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMessages(list);
          
          // if any new messages, keep bottom view
          setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
        },
        (e) => console.log("Messages listener error:", e?.code, e?.message)
      );

      // Listen to thread strictly to update seen logic
      const unsubThread = onSnapshot(doc(db, "threads", threadId), (snap) => {
         if (snap.exists()) {
             const data = snap.data();
             const theirUnread = data?.unread?.[otherUserId] || 0;
             // if they have 0 unread messages, it means they have seen the last message sent by me
             setLastMessageReadByThem(theirUnread === 0);
         }
      });
      return () => {
         unsub();
         unsubThread();
      };
    });

    return () => {
      if (unsub) unsub();
    };
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

  const toggleSelect = (msgId) => {
    const next = new Set(selectedMessages);
    next.has(msgId) ? next.delete(msgId) : next.add(msgId);
    setSelectedMessages(next);
  };

  const deleteSelected = async () => {
    if (selectedMessages.size === 0) return;

    Alert.alert("Delete Messages?", "Are you sure you want to delete the selected messages?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Delete",
        style: "destructive",
        onPress: async () => {
          try {
             // delete selected from firestore
             for (const msgId of selectedMessages) {
                await deleteDoc(doc(db, "threads", threadId, "messages", msgId));
             }
             setSelectedMessages(new Set());
             setIsDeletingMode(false);
          } catch (e) {
             console.log("Delete error", e);
             Alert.alert("Error", "Could not delete messages");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["bottom"]}>
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.topbar, { borderColor: theme.border }]}>
            {isDeletingMode ? (
                <Pressable onPress={() => { setIsDeletingMode(false); setSelectedMessages(new Set()); }} hitSlop={12} style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <Feather name="x" size={20} color={theme.icon} />
                </Pressable>
            ) : (
                <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <Feather name="arrow-left" size={20} color={theme.icon} />
                </Pressable>
            )}

          <Pressable
            style={styles.headerProfileRow}
            onPress={() => navigation.navigate("UserProfile", { userId: otherUserId })}
            hitSlop={10}
          >
            {/* Header Avatar */}
            {otherUser?.photoURL ? (
                <Image source={{ uri: otherUser.photoURL }} style={styles.headerAvatar} />
            ) : (
                <View style={[styles.headerAvatarPlaceholder, { backgroundColor: theme.placeholder, borderColor: theme.border }]}>
                   <Feather name="user" size={14} color={theme.icon} />
                </View>
            )}

            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              @{otherUsername || "user"}
            </Text>
          </Pressable>

          <View style={{ width: 40, alignItems: 'flex-end' }}>
             {/* Delete Menu Trigger */}
             {!isDeletingMode && (
                <Pressable hitSlop={10} onPress={() => setShowDeleteMenu(true)}>
                    <Feather name="more-vertical" size={20} color={theme.icon} />
                </Pressable>
             )}
             {isDeletingMode && selectedMessages.size > 0 && (
                <Pressable hitSlop={10} onPress={deleteSelected}>
                    <Feather name="trash-2" size={20} color="#FF3B30" />
                </Pressable>
             )}
          </View>
        </View>

        {/* Delete Options Modal Dropdown */}
        <Modal visible={showDeleteMenu} transparent animationType="fade">
           <TouchableWithoutFeedback onPress={() => setShowDeleteMenu(false)}>
              <View style={styles.modalBackdrop} />
           </TouchableWithoutFeedback>
           <View style={[styles.dropdownMenu, { backgroundColor: theme.card, borderColor: theme.border }]}>
               <Pressable 
                  style={styles.dropdownItem}
                  onPress={() => {
                     setIsDeletingMode(true);
                     setShowDeleteMenu(false);
                  }}
               >
                  <Feather name="trash-2" size={16} color={theme.text} />
                  <Text style={[styles.dropdownText, { color: theme.text }]}>Select Messages</Text>
               </Pressable>
           </View>
        </Modal>

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
            renderItem={({ item, index }) => {
              const mine = item.from === uid;
              const isSelected = selectedMessages.has(item.id);
              // if mine and it's the last message I sent, show seen or sent status
              const isLastMessageISent = mine && index === messages.map(m => m.from === uid).lastIndexOf(true);
              
              return (
                <Pressable 
                   style={[styles.messageRow, mine ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}
                   onPress={() => {
                      if (isDeletingMode) toggleSelect(item.id);
                   }}
                >
                   {/* Selection Circle in Delete Mode */}
                   {isDeletingMode && (
                      <View style={[styles.selectCircle, { borderColor: theme.border }, isSelected && { backgroundColor: theme.buttonBg, borderColor: theme.buttonBg }]}>
                         {isSelected && <Feather name="check" size={12} color={theme.buttonText} />}
                      </View>
                   )}

                   {/* Other User Avatar */}
                   {!mine && (
                      otherUser?.photoURL ? (
                          <Image source={{ uri: otherUser.photoURL }} style={styles.chatAvatar} />
                      ) : (
                          <View style={[styles.chatAvatarPlaceholder, { backgroundColor: theme.placeholder, borderColor: theme.border }]}>
                             <Feather name="user" size={14} color={theme.icon} />
                          </View>
                      )
                   )}

                  <View style={[styles.bubbleWrap, mine ? { alignItems: "flex-end"} : { alignItems: "flex-start" }]}>
                    <View style={[styles.bubble, mine ? [styles.me, { backgroundColor: isDark ? "#4B3275" : "#E8D8FF" }] : [styles.them, { backgroundColor: isDark ? theme.card : "#F2F2F2" }]]}>
                        <Text style={[styles.bubbleText, mine ? { color: isDark ? "#fff" : "#111" } : { color: theme.text }]}>{item.text}</Text>
                    </View>
                    {isLastMessageISent && (
                        lastMessageReadByThem ? (
                          <Text style={[styles.seenText, { color: theme.textSecondary }]}>Seen</Text>
                        ) : (
                          <View style={styles.sentContainer}>
                             <Text style={[styles.seenText, { color: theme.textSecondary, marginRight: 2 }]}>Sent</Text>
                             <Feather name="check" size={10} color={theme.textSecondary} style={{ marginTop: 4 }} />
                          </View>
                        )
                    )}
                  </View>
                </Pressable>
              );
            }}
          />

          {/* Input */}
          {!isDeletingMode && (
             <View style={[styles.inputRow, { borderTopColor: theme.bg }]}>
               <TextInput
                 value={text}
                 onChangeText={setText}
                 placeholder="Type a message…"
                 placeholderTextColor={theme.textSecondary}
                 style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                 returnKeyType="send"
                 onSubmitEditing={send}
               />
               <Pressable onPress={send} style={[styles.sendBtn, { backgroundColor: theme.buttonBg }, sending && { opacity: 0.6 }]}>
                 <Text style={[styles.sendText, { color: theme.buttonText }]}>{sending ? "..." : "Send"}</Text>
               </Pressable>
             </View>
          )}
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
  headerProfileRow: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "70%" },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  title: { fontSize: 14, fontWeight: "900", color: "#111", flexShrink: 1 },
  
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "transparent" },
  dropdownMenu: { position: "absolute", top: 80, right: 20, width: 160, borderRadius: 12, padding: 8, borderWidth: 1, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  dropdownItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  dropdownText: { fontSize: 13, fontWeight: "700" },

  messageRow: { flexDirection: "row", alignItems: "flex-end", width: "100%", marginVertical: 4 },
  selectCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, marginRight: 8, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  chatAvatar: { width: 26, height: 26, borderRadius: 13, marginRight: 8 },
  chatAvatarPlaceholder: { width: 26, height: 26, borderRadius: 13, marginRight: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  
  bubbleWrap: { maxWidth: "75%" },

  bubble: {
    padding: 10,
    borderRadius: 12,
  },
  me: { backgroundColor: "#E8D8FF", borderBottomRightRadius: 2 },
  them: { backgroundColor: "#F2F2F2", borderBottomLeftRadius: 2 },
  bubbleText: { fontSize: 13, fontWeight: "800", color: "#111" },
  seenText: { fontSize: 10, marginTop: 4, fontWeight: "700", opacity: 0.7, alignSelf: "flex-end" },
  sentContainer: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end" },

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
