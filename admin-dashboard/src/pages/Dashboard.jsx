import React, { useEffect, useState } from "react";
import AdminTopbar from "../components/AdminTopBar";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "../firebase";

export default function Dashboard() {
  const [stats, setStats] = useState({ users: 0, posts: 0 });

  useEffect(() => {
    const run = async () => {
      try {
        const [usersSnap, postsSnap] = await Promise.all([
          getCountFromServer(collection(db, "users")),
          getCountFromServer(collection(db, "posts")),
        ]);
        setStats({
          users: usersSnap.data().count,
          posts: postsSnap.data().count,
        });
      } catch (e) {
        console.log(e);
      }
    };
    run();
  }, []);

  return (
    <div>
      <AdminTopbar />
      <div style={styles.wrap}>
        <h2 style={{ marginTop: 0 }}>Dashboard</h2>

        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.big}>{stats.users}</div>
            <div style={styles.label}>Total Users</div>
          </div>
          <div style={styles.card}>
            <div style={styles.big}>{stats.posts}</div>
            <div style={styles.label}>Total Posts</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: 16, fontFamily: "system-ui" },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  card: { border: "1px solid #eee", borderRadius: 16, padding: 16, background: "#fff" },
  big: { fontSize: 30, fontWeight: 900, color: "#111" },
  label: { marginTop: 6, fontWeight: 800, opacity: 0.7 },
};
