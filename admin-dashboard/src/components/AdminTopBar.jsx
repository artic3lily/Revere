import React from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function AdminTopbar() {
  return (
    <div style={styles.bar}>
      <div style={{ fontWeight: 900 }}>Revere Admin</div>

      <div style={styles.links}>
        <Link style={styles.link} to="/">Dashboard</Link>
        <Link style={styles.link} to="/users">Users</Link>
        <Link style={styles.link} to="/posts">Posts</Link>
      </div>

      <button style={styles.btn} onClick={() => signOut(auth)}>
        Logout
      </button>
    </div>
  );
}

const styles = {
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderBottom: "1px solid #eee",
    fontFamily: "system-ui",
  },
  links: { display: "flex", gap: 12 },
  link: { textDecoration: "none", color: "#111", fontWeight: 800 },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
};
