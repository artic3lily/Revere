import React from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function NotAdmin() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2>Access denied</h2>
      <p>Your account is not an admin.</p>

      <button
        onClick={() => signOut(auth)}
        style={{
          padding: 10,
          borderRadius: 10,
          border: "1px solid #111",
          background: "#111",
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  );
}
