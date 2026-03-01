import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

import { loadChatMessages, saveChatMessage } from "../services/chatStore";
import { auth } from "../config/firebase";

const functions = getFunctions(getApp());
const fashionChat = httpsCallable(functions, "fashionChat");

export default function ChatbotScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);


  const [dots, setDots] = useState(".");
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => {
      setDots((d) => (d === "." ? ".." : d === ".." ? "..." : "."));
    }, 450);
    return () => clearInterval(t);
  }, [loading]);

  // Load saved messages when screen opens
  useEffect(() => {
    const run = async () => {
      try {
        if (!auth.currentUser?.uid) return;
        const saved = await loadChatMessages(80);
        setMessages(saved.map((m) => ({ role: m.role, content: m.content })));
      } catch (e) {
        console.log("Load chat error:", e?.message || e);
      }
    };
    run();
  }, []);

  // auto-scroll
  const listRef = useRef(null);
  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    });
  };

  const dataWithTyping = useMemo(() => {
    // while loading, show "typing" bubble 
    if (!loading) return messages;
    return [...messages, { role: "assistant_typing", content: `Typing${dots}` }];
  }, [messages, loading, dots]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];

    // show user message immediately
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    scrollToEnd();

    try {
      // save user message
      if (auth.currentUser?.uid) {
        await saveChatMessage("user", userMessage.content);
      }

      const result = await fashionChat({ messages: updatedMessages });

      // show assistant message
      setMessages((prev) => [...prev, result.data]);
      scrollToEnd();

      // save assistant message
      if (auth.currentUser?.uid) {
        await saveChatMessage("assistant", result.data.content);
      }
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry. Something went wrong." },
      ]);
      scrollToEnd();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "android" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "android" ? 0 : 80}
      >
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
          {/* Header arrow */}
          <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
            <Pressable
              hitSlop={12}
              style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={22} color={theme.icon} />
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="smile" size={18} color={theme.text} />
                <Text style={[styles.title, { color: theme.text }]}>Miss Ray</Text>
            </View>

            {/* spacer to keep title centered */}
            <View style={{ width: 40 }} />
          </View>

          <FlatList
            ref={listRef}
            data={dataWithTyping}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={{ paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToEnd}
            renderItem={({ item }) => {
              const isUser = item.role === "user";
              const isTyping = item.role === "assistant_typing";

              return (
                <View
                  style={[
                    styles.bubble,
                    isUser ? [styles.user, { backgroundColor: isDark ? "#4B3275" : "#E8D8FF" }] : [styles.bot, { backgroundColor: theme.card }],
                    isTyping && styles.typingBubble,
                  ]}
                >
                  <Text style={[styles.msgText, isUser ? { color: isDark ? "#fff" : "#111" } : { color: theme.text }]}>{item.content}</Text>
                </View>
              );
            }}
          />

          {/* Input bar */}
          <View style={[styles.inputRow, { backgroundColor: theme.bg }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about outfits, styling..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={sendMessage} style={[styles.send, { backgroundColor: theme.buttonBg }]}>
              <Text style={[styles.sendText, { color: theme.buttonText }]}>{loading ? "..." : "Send"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },

  // Header
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backBtn: {
    width: 40,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "900", color: "#111" },

  // Chat bubbles
  bubble: {
    padding: 10,
    marginVertical: 4,
    maxWidth: "80%",
    borderRadius: 12,
  },
  msgText: { fontSize: 13, fontWeight: "700", color: "#111" },
  user: { alignSelf: "flex-end", backgroundColor: "#E8D8FF" },
  bot: { alignSelf: "flex-start", backgroundColor: "#F2F2F2" },
  typingBubble: { opacity: 0.75 },

  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  send: {
    marginLeft: 8,
    backgroundColor: "#000",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  sendText: { color: "#fff", fontWeight: "900" },
});
