import React, { useEffect, useMemo, useState } from "react";
import AdminTopbar from "../components/AdminTopBar";
import { collection, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function Posts() {
  const [posts, setPosts] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "posts"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(list);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return posts;
    return posts.filter((p) => {
      const caption = (p.caption || "").toLowerCase();
      const category = (p.category || "").toLowerCase();
      const username = (p.ownerUsername || "").toLowerCase();
      return caption.includes(s) || category.includes(s) || username.includes(s);
    });
  }, [posts, q]);

  const removePost = async (postId) => {
    if (!confirm("Delete this post?")) return;
    await deleteDoc(doc(db, "posts", postId));
  };

  return (
    <div>
      <AdminTopbar />
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <h2 style={{ marginTop: 0 }}>Posts</h2>

        <input
          placeholder="Search caption / category / username..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={styles.input}
        />

        <div style={styles.grid}>
          {filtered.map((p) => (
            <div key={p.id} style={styles.card}>
              <div style={{ fontWeight: 900 }}>
                @{p.ownerUsername || "user"} • {p.category || "No category"}
              </div>

              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: 180,
                    objectFit: "cover",
                    borderRadius: 12,
                    marginTop: 10,
                    border: "1px solid #eee",
                  }}
                />
              ) : null}

              <div style={{ marginTop: 10, fontWeight: 700, opacity: 0.8 }}>
                {p.caption || "No caption"}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button style={styles.btnDanger} onClick={() => removePost(p.id)}>
                  Delete
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
  grid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 },
  card: { border: "1px solid #eee", borderRadius: 16, padding: 12, background: "#fff" },
  btnDanger: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #b00020",
    background: "#b00020",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
};
