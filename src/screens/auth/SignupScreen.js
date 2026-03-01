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
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    if (!email.trim() || !fullName.trim() || !username.trim() || !password || !confirmPassword) {
      Alert.alert("Missing fields", "Please fill all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Confirm password does not match.");
      return;
    }

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      await setDoc(doc(db, "users", uid), {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        role: "user",
        accountStatus: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
        console.log("SIGNUP ERROR CODE:", err?.code);
        console.log("SIGNUP ERROR MESSAGE:", err?.message);
        Alert.alert("Signup failed", `${err?.code}\n${err?.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>Revere</Text>
        </View>

        <Text style={styles.title}>Hello!{"\n"}Amigo</Text>
        <Text style={styles.subtitle}>Ready to get you a style?</Text>
        <Text style={styles.subtitle}>Lets create an account</Text>

        <View style={styles.form}>
          <UnderlineInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <UnderlineInput
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
          />

          <UnderlineInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          {/* Password */}
          <UnderlinePasswordInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            onToggle={() => setShowPass((p) => !p)}
          />

          {/* Confirm Password */}
          <UnderlinePasswordInput
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            onToggle={() => setShowConfirm((p) => !p)}
          />
        </View>

        <Pressable style={styles.btnOutline} onPress={onSignup} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Signing Up..." : "Sign Up"}</Text>
        </Pressable>

        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>Have an account? </Text>
          <Pressable onPress={() => navigation.navigate("Login")}>
            <Text style={styles.bottomLink}>Log in</Text>
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

  title: { fontSize: 44, fontWeight: "800", color: "#111", marginTop: 18 },
  subtitle: { fontSize: 13, color: "#111", marginTop: 6 },

  form: { marginTop: 22 },

  underlineWrap: { marginBottom: 18 },
  input: {
    fontSize: 14,
    color: "#111",
    height: 40,
    paddingVertical: 8,
  },
  line: { height: 1, backgroundColor: "#111", opacity: 0.65 },

  // try password styles
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

  btnOutline: {
    marginTop: 14,
    borderWidth: 1.4,
    borderColor: "#111",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { fontSize: 15, fontWeight: "700", color: "#111" },

  bottomRow: { marginTop: 18, flexDirection: "row", justifyContent: "center" },
  bottomText: { color: "#111" },
  bottomLink: { color: "#111", fontWeight: "800", textDecorationLine: "underline" },
});
