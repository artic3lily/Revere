// src/auth/AdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAdmin } from "./useAdmin";

export default function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Loading...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/not-admin" replace />;

  return children;
}
