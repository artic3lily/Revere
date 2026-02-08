import React, { useEffect, useMemo, useState } from "react";
import AdminTopbar from "../components/AdminTopBar";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const email = (u.email || "").toLowerCase();
      const username = (u.username || "").toLowerCase();
      const fullName = (u.fullName || "").toLowerCase();
      return email.includes(s) || username.includes(s) || fullName.includes(s);
    });
  }, [users, q]);

  const setBanned = async (uid, banned) => {
    await updateDoc(doc(db, "users", uid), { banned: !!banned });
  };

  return (
    <div>
      <AdminTopbar />
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <h2 style={{ marginTop: 0 }}>Users</h2>

        <input
          placeholder="Search email / username / name..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={styles.input}
        />

        <div style={styles.table}>
          <div style={styles.rowHead}>
            <div>Username</div>
            <div>Email</div>
            <div>Role</div>
            <div>Status</div>
            <div>Action</div>
          </div>

          {filtered.map((u) => (
            <div key={u.id} style={styles.row}>
              <div>@{u.username || "-"}</div>
              <div>{u.email || "-"}</div>
              <div>{u.role || "user"}</div>
              <div style={{ fontWeight: 900 }}>
                {u.banned ? "BANNED" : "OK"}
              </div>
              <div>
                <button
                  onClick={() => setBanned(u.id, !u.banned)}
                  style={styles.btn}
                >
                  {u.banned ? "Unban" : "Ban"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
    marginBottom: 12,
  },
  table: { border: "1px solid #eee", borderRadius: 16, overflow: "hidden", background: "#fff" },
  rowHead: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 0.8fr 0.8fr 0.8fr",
    gap: 10,
    padding: 12,
    fontWeight: 900,
    borderBottom: "1px solid #eee",
    background: "#fafafa",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 0.8fr 0.8fr 0.8fr",
    gap: 10,
    padding: 12,
    borderBottom: "1px solid #eee",
    alignItems: "center",
    fontWeight: 700,
  },
  btn: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
};
