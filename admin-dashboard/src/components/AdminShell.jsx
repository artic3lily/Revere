import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

import AdminSidebar from "./AdminSidebar";
import AdminTopBar from "./AdminTopBar";

export default function AdminShell({ children }) {
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setAdminUser(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? snap.data() : null;

        if (!data || data.role !== "admin") {
          setAdminUser(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setAdminUser({
          uid: user.uid,
          email: user.email,
          username: data.username || "",
          fullName: data.fullName || "",
        });

        setIsAdmin(true);
        setLoading(false);
      } catch (err) {
        console.error("Admin check error:", err);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const doLogout = async () => {
    await signOut(auth);
  };

  //While checking auth
  if (loading) {
    return (
      <div className="pageCenter">
        <div className="loaderCard">
          <div className="loaderDot" />
          <p className="muted">Checking admin access…</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!auth.currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Logged in but not admin
  if (!isAdmin) {
    return <Navigate to="/not-admin" replace />;
  }

  // Admin allowed
  return (
    <div className="shell">
      <AdminSidebar activePath={location.pathname} />
      <div className="main">
        <AdminTopBar adminUser={adminUser} onLogout={doLogout} />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
