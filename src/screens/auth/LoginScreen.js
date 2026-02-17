import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  SafeAreaView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatUntil = (ts) => {
    try {
      if (!ts) return null;
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString();
    } catch {
      return null;
    }
  };

  const onLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      // 1) Auth login
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user?.uid;

      if (!uid) {
        await signOut(auth);
        Alert.alert("Login failed", "Could not verify your account. Try again.");
        return;
      }

      // 2) Check Firestore user status
      const snap = await getDoc(doc(db, "users", uid));

      if (!snap.exists()) {
        await signOut(auth);
        Alert.alert(
          "Account missing",
          "Your user profile is not set up yet. Please sign up again or contact support."
        );
        return;
      }

      const u = snap.data() || {};
      const status = String(u.accountStatus || "active").toLowerCase();

      // 3) Ban / suspend handling
      if (status === "banned") {
        const reason = u.banReason ? `\n\nReason: ${u.banReason}` : "";
        await signOut(auth);
        Alert.alert(
          "Account banned",
          `Your account has been banned.${reason}\n\nIf you think this is a mistake, contact support.`
        );
        return;
      }

      if (status === "suspended") {
        const until = u.suspendedUntil;
        const untilDate = until?.toDate ? until.toDate() : null;

        // If suspendedUntil exists and is still in the future => block
        if (untilDate && untilDate.getTime() > Date.now()) {
          const untilText = formatUntil(until) || "later";
          await signOut(auth);
          Alert.alert(
            "Account suspended",
            `Your account is temporarily suspended until ${untilText}.\n\nPlease try again later.`
          );
          return;
        }
        // If suspension expired, allow login here admin can set accountStatus back to active later
      }

      //If active (or suspension expired), does ntg
    } catch (err) {
      Alert.alert("Login failed", err?.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Enter email", "Please enter your email first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Email sent", "Password reset email has been sent.");
    } catch (err) {
      Alert.alert("Error", err?.message ?? "Could not send reset email");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>Revere</Text>
        </View>

        <Text style={styles.title}>Welcome{"\n"}Back! Amigo!</Text>

        <View style={styles.form}>
          <UnderlineInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <UnderlinePasswordInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            onToggle={() => setShowPass((p) => !p)}
          />

          <View style={styles.row}>
            <Pressable
              style={styles.rememberRow}
              onPress={() => setRemember((r) => !r)}
            >
              <View style={[styles.checkbox, remember && styles.checkboxActive]} />
              <Text style={styles.smallText}>Remember me</Text>
            </Pressable>

            <Pressable onPress={onForgotPassword}>
              <Text style={[styles.smallText, styles.link]}>Forgot Password?</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.btnOutline} onPress={onLogin} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Logging in..." : "Log In"}</Text>
        </Pressable>

        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>Don't have an account? </Text>
          <Pressable onPress={() => navigation.navigate("Signup")}>
            <Text style={styles.bottomLink}>Sign up</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function UnderlineInput(props) {
  return (
    <View style={styles.underlineWrap}>
      <TextInput {...props} style={styles.input} placeholderTextColor="#444" />
      <View style={styles.line} />
    </View>
  );
}

function UnderlinePasswordInput({ onToggle, ...props }) {
  return (
    <View style={styles.underlineWrap}>
      <View style={styles.passRow}>
        <TextInput
          {...props}
          autoCapitalize="none"
          style={styles.passInput}
          placeholderTextColor="#444"
          selectionColor="#111"
        />
        <Pressable onPress={onToggle} style={styles.eyeBtn} hitSlop={10}>
          <Feather name="eye" size={18} color="#111" />
        </Pressable>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 10 },

  topRow: { alignItems: "flex-end", marginTop: 4 },
  brand: { fontSize: 14, color: "#111" },

  title: { fontSize: 36, fontWeight: "800", color: "#111", marginTop: 22 },

  form: { marginTop: 26 },

  underlineWrap: { marginBottom: 18 },
  input: {
    fontSize: 14,
    color: "#111",
    height: 40,
    paddingVertical: 8,
  },
  line: { height: 1, backgroundColor: "#111", opacity: 0.65 },

  passRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
  },
  passInput: {
    flex: 1,
    fontSize: 14,
    color: "#111",
    height: 40,
    paddingVertical: 8,
    paddingRight: 36,
  },
  eyeBtn: {
    position: "absolute",
    right: 6,
    padding: 6,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: "#111",
    marginRight: 6,
  },
  checkboxActive: {
    backgroundColor: "#111",
  },

  smallText: { fontSize: 12, color: "#111" },
  link: { textDecorationLine: "underline" },

  btnOutline: {
    marginTop: 18,
    borderWidth: 1.4,
    borderColor: "#111",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { fontSize: 15, fontWeight: "700", color: "#111" },

  bottomRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
  },
  bottomText: { color: "#111" },
  bottomLink: {
    color: "#111",
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});
