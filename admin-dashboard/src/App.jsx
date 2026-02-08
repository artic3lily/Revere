import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminRoute from "./auth/AdminRoute";

import Login from "./pages/Login";
import NotAdmin from "./pages/NotAdmin";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Posts from "./pages/Posts";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/not-admin" element={<NotAdmin />} />

      <Route
        path="/"
        element={
          <AdminRoute>
            <Dashboard />
          </AdminRoute>
        }
      />

      <Route
        path="/users"
        element={
          <AdminRoute>
            <Users />
          </AdminRoute>
        }
      />

      <Route
        path="/posts"
        element={
          <AdminRoute>
            <Posts />
          </AdminRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
