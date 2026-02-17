import React, { useEffect, useMemo, useState } from "react";
import StatCard from "../components/StatCard";
import Table from "../components/Table";
import { db } from "../firebase";
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from "firebase/firestore";

export default function Dashboard() {
  const [stats, setStats] = useState({
    users: 0,
    posts: 0,
    reported: 0,
    suspended: 0,
  });

  const [recentPosts, setRecentPosts] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    const run = async () => {
      // counts
      const [usersSnap, postsSnap] = await Promise.all([
        getCountFromServer(collection(db, "users")),
        getCountFromServer(collection(db, "posts")),
      ]);

      // suspended users count
      const usersQ = query(collection(db, "users"), limit(8));
      const usersDocs = await getDocs(usersQ);
      const usersList = usersDocs.docs.map((d) => ({ id: d.id, ...d.data() }));

      const suspendedCount = usersList.filter((u) => u.status === "suspended").length;

      // recent posts
      const postsQ = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(8));
      const postsDocs = await getDocs(postsQ);
      const postsList = postsDocs.docs.map((d) => ({ id: d.id, ...d.data() }));

      setStats({
        users: usersSnap.data().count,
        posts: postsSnap.data().count,
        reported: 0, // (later we can add reports collection)
        suspended: suspendedCount,
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

  return (
    <div className="dash">
      <div className="grid4">
        <StatCard label="Total Users" value={stats.users} hint="Registered accounts" icon="👥" />
        <StatCard label="Total Posts" value={stats.posts} hint="Listings uploaded" icon="🧥" />
        <StatCard label="Suspended" value={stats.suspended} hint="Users limited by admin" icon="⛔" />
        <StatCard label="Reports" value={stats.reported} hint="Coming next" icon="🚩" />
      </div>

      <div className="split">
        <div>
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Recent Posts</div>
              <div className="sectionHint">Latest items added by sellers</div>
            </div>
          </div>
          <Table columns={postCols} rows={recentPosts} emptyText="No posts yet." />
        </div>

        <div>
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Recent Users</div>
              <div className="sectionHint">New accounts overview</div>
            </div>
          </div>
          <Table columns={userCols} rows={recentUsers} emptyText="No users yet." />
        </div>
      </div>
    </div>
  );
}
