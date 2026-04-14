import React, { useState, useEffect } from "react";
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
import { Modal } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    loadRememberedEmail();
  }, []);

  const loadRememberedEmail = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem("rememberedEmail");
      if (savedEmail) {
        setEmail(savedEmail);
        setRemember(true);
      }
    } catch (e) {
      console.log("Error loading remembered email:", e);
    }
  };

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
      setError("Please enter both email and password.");
      return;
    }

    setError("");

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

      // Handle "Remember me" logic
      if (remember) {
        await AsyncStorage.setItem("rememberedEmail", email.trim());
      } else {
        await AsyncStorage.removeItem("rememberedEmail");
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
      console.log("Login error:", err?.code || err?.message);
      setError("wrong email or password(ᵕ—ᴗ—), try again.");
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
      setSuccessMsg("Password reset email has been sent. (˶ᵔ ᵕ ᵔ˶)");
      setShowSuccess(true);
    } catch (err) {
      setError(err?.message ?? "Could not send reset email");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>𝓡𝓮𝓿𝓮𝓻𝓮</Text>
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

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

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconCircle}>
              <Feather name="check" size={28} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Email Sent</Text>
            <Text style={styles.successBody}>{successMsg}</Text>
            <Pressable 
              style={styles.doneButton}
              onPress={() => setShowSuccess(false)}
            >
              <Text style={styles.doneButtonText}>Got it!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
          <Feather name={props.secureTextEntry ? "eye-off" : "eye"} size={18} color="#111" />
        </Pressable>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 10 },

  topRow: { alignItems: "flex-end", marginTop: 24 },
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
  errorText: {
    color: "#ff3b30",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  successModal: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#111",
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    marginBottom: 8,
  },
  successBody: {
    fontSize: 14,
    fontWeight: "700",
    color: "#444",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  doneButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: "#111",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
});
