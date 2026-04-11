import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { auth } from "../../config/firebase";
import { sendEmailVerification, signOut } from "firebase/auth";

export default function VerifyEmailScreen({ onVerified }) {
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleCheckVerification = async () => {
    try {
      setLoading(true);
      // Reload the user to check if emailVerified has changed to true
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        // Hand off to AppNavigator which will switch to HomeScreen
        if (onVerified) onVerified();
      } else {
        Alert.alert("Not Verified Yet", "Please check your inbox (and Spam folder!) and click the verification link first.");
      }
    } catch (error) {
      console.log("Check verification error:", error);
      Alert.alert("Error", "Could not verify your status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        Alert.alert("Sent", `A new verification email has been sent to ${auth.currentUser.email}`);
      }
    } catch (error) {
      console.log("Resend email error:", error);
      if (error.code === "auth/too-many-requests") {
        Alert.alert("Hold on", "We've sent an email recently. Please check your spam folder or wait a minute before requesting another.");
      } else {
        Alert.alert("Error", "Could not send another email. Please try again later.");
      }
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log("Signout error:", error);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>𝓡𝓮𝓿𝓮𝓻𝓮</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Feather name="mail" size={42} color="#111" />
          </View>
          
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            Almost there! We've sent a verification email to:
          </Text>
          <Text style={styles.emailText}>
            {auth.currentUser?.email}
          </Text>
          <Text style={styles.instruction}>
            Click the link in the email to activate your account.
          </Text>
          <Text style={[styles.instruction, { marginTop: -20, fontSize: 13, fontWeight: "700", color: "#d32f2f" }]}>
            Tip: Check your Spam or Junk folder!
          </Text>

          <View style={styles.actions}>
            <Pressable 
              style={[styles.btnPrimary, loading && { opacity: 0.7 }]} 
              onPress={handleCheckVerification}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnTextPrimary}>I've Verified</Text>
              )}
            </Pressable>

            <Pressable 
              style={[styles.btnOutline, resending && { opacity: 0.7 }]} 
              onPress={handleResend}
              disabled={resending}
            >
              {resending ? (
                <ActivityIndicator color="#111" />
              ) : (
                <Text style={styles.btnTextOutline}>Resend Email</Text>
              )}
            </Pressable>
          </View>
        </View>

        <Pressable onPress={handleSignOut} style={styles.bottomLink}>
          <Text style={styles.cancelText}>Return to Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 10 },
  topRow: { alignItems: "flex-end", marginTop: 24 },
  brand: { fontSize: 14, color: "#111" },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#f2f2f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 6,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 16,
  },
  instruction: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 36,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  actions: {
    width: "100%",
    gap: 14,
  },
  btnPrimary: {
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  btnTextPrimary: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  btnTextOutline: {
    color: "#111",
    fontSize: 16,
    fontWeight: "700",
  },
  bottomLink: {
    marginBottom: 30,
    alignItems: "center",
  },
  cancelText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
