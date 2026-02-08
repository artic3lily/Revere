import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const onLogin = async () => {
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      // route guard will redirect automatically
    } catch (e) {
      setErr(e?.message || "Login failed");
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={{ margin: 0 }}>Revere Admin</h2>
        <p style={{ marginTop: 6, opacity: 0.7 }}>Login to continue</p>

        <input
          style={styles.input}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="Password"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        {err ? <div style={styles.err}>{err}</div> : null}

        <button style={styles.btn} onClick={onLogin}>
          Login
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily: "system-ui",
    background: "#fafafa",
  },
  card: {
    width: 360,
    border: "1px solid #eee",
    borderRadius: 16,
    padding: 18,
    background: "#fff",
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ddd",
    marginTop: 10,
    outline: "none",
  },
  btn: {
    width: "100%",
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  err: {
    marginTop: 10,
    color: "#b00020",
    fontWeight: 700,
    fontSize: 13,
  },
};
