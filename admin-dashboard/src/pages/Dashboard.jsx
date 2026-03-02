import React, { useEffect, useMemo, useState } from "react";
import StatCard from "../components/StatCard";
import Table from "../components/Table";
import { db } from "../firebase";
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    users: 0,
    posts: 0,
    reportsPending: 0,
    suspended: 0,
    banned: 0,
  });

  const [recentPosts, setRecentPosts] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    const run = async () => {
      const [usersSnap, postsSnap, reportsSnap, bannedSnap] = await Promise.all([
        getCountFromServer(collection(db, "users")),
        getCountFromServer(collection(db, "posts")),
        getCountFromServer(query(collection(db, "reports"), where("status", "==", "pending"))),
        getCountFromServer(query(collection(db, "users"), where("accountStatus", "==", "banned"))),
      ]);

      const suspQ = query(collection(db, "users"), where("accountStatus", "==", "suspended"));
      const suspDocs = await getDocs(suspQ);
      const now = Date.now();
      let actualSuspended = 0;
      suspDocs.forEach((d) => {
        const u = d.data();
        let until = null;
        if (u.suspendedUntil) {
          until = u.suspendedUntil.toDate ? u.suspendedUntil.toDate() : new Date(u.suspendedUntil);
        }
        if (until && until.getTime() > now) {
          actualSuspended++;
        }
      });

      // recent users
      const usersQ = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5));
      const usersDocs = await getDocs(usersQ);
      const usersList = usersDocs.docs.map((d) => ({ id: d.id, ...d.data() }));

      // recent posts
      const postsQ = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(5));
      const postsDocs = await getDocs(postsQ);
      const postsList = postsDocs.docs.map((d) => ({ id: d.id, ...d.data() }));

      setStats({
        users: usersSnap.data().count,
        posts: postsSnap.data().count,
        reportsPending: reportsSnap.data().count,
        suspended: actualSuspended,
        banned: bannedSnap.data().count,
      });

      setRecentUsers(usersList);
      setRecentPosts(postsList);
    };

    run();
  }, []);

  const postCols = useMemo(
    () => [
      { key: "caption", title: "Caption", render: (r) => (r.caption || "—").slice(0, 40) },
      { key: "ownerUsername", title: "Seller", render: (r) => `@${r.ownerUsername || "user"}` },
      { key: "price", title: "Price", render: (r) => (typeof r.price === "number" ? `Rs. ${r.price}` : "—") },
      { key: "category", title: "Category", render: (r) => r.category || "—" },
    ],
    []
  );

  const userCols = useMemo(
    () => [
      { key: "username", title: "Username", render: (r) => `@${r.username || "user"}` },
      { key: "email", title: "Email", render: (r) => r.email || "—" },
      { key: "status", title: "Status", render: (r) => r.status || "active" },
    ],
    []
  );

  // Calculate chart metrics
  const activeCount = Math.max(0, stats.users - stats.suspended - stats.banned);
  const totalUsersChart = stats.users || 1;
  const activePct = (activeCount / totalUsersChart) * 100;
  const suspPct = (stats.suspended / totalUsersChart) * 100;
  // bannedPct is remainder

  const pieStyle = {
    background: `conic-gradient(
      var(--accent2) 0% ${activePct}%, 
      var(--warn) ${activePct}% ${activePct + suspPct}%,
      var(--danger) ${activePct + suspPct}% 100%
    )`
  };

  return (
    <div className="dash">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Admin Dashboard</div>
          <div className="pageHint">Platform overview and recent activity</div>
        </div>
      </div>

      <div className="grid4">
        <StatCard label="Total Users" value={stats.users} hint="Registered accounts" icon="👥" onClick={() => navigate('/users')} />
        <StatCard label="Total Posts" value={stats.posts} hint="Listings uploaded" icon="🧥" onClick={() => navigate('/posts')} />
        <StatCard label="Pending Reports" value={stats.reportsPending} hint="Needs review" icon="🚩" onClick={() => navigate('/reports')} />
        <StatCard label="Total Suspended" value={stats.suspended} hint="Users limited by admin" icon="⛔" onClick={() => navigate('/users', { state: { statusFilter: "suspended" } })} />
      </div>

      <div className="chartGrid">
        {/* Left: Charts / Summaries */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>User Base Overview</div>
          <div className="muted small" style={{ marginBottom: 16 }}>Active vs Suspended vs Banned</div>

          <div className="pieContainer">
            <div className="pieChart" style={pieStyle}>
              <div className="pieHole"></div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            <div className="legendLine">
              <div className="dot" style={{ background: 'var(--accent2)' }}></div>
              <span style={{ flex: 1 }}>Active Users</span>
              <span>{activeCount}</span>
            </div>
            <div className="legendLine">
              <div className="dot" style={{ background: 'var(--warn)' }}></div>
              <span style={{ flex: 1 }}>Suspended</span>
              <span>{stats.suspended}</span>
            </div>
            <div className="legendLine">
              <div className="dot" style={{ background: 'var(--danger)' }}></div>
              <span style={{ flex: 1 }}>Banned</span>
              <span>{stats.banned}</span>
            </div>
          </div>
        </div>

        {/* Right: Latest Posts */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Latest Posts</div>
              <div className="muted small">Most recent items added by sellers</div>
            </div>
            <button className="btnGhost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => navigate('/posts')}>View All</button>
          </div>
          <div className="tableCard" style={{ border: 'none', boxShadow: 'none' }}>
            <Table columns={postCols} rows={recentPosts} emptyText="No posts yet." />
          </div>
        </div>
      </div>

      {/* Bottom: Recent Users */}
      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Newest Users</div>
            <div className="muted small">Latest accounts registered</div>
          </div>
          <button className="btnGhost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => navigate('/users')}>View All</button>
        </div>
        <div className="tableCard" style={{ border: 'none', boxShadow: 'none' }}>
          <Table columns={userCols} rows={recentUsers} emptyText="No users yet." />
        </div>
      </div>
    </div>
  );
}
