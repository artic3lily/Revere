import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Posts from "./pages/Posts";
import Reports from "./pages/Reports";
import NotAdmin from "./pages/NotAdmin";

import AdminShell from "./components/AdminShell";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Admin Layout */}
      <Route
        path="/"
        element={
          <AdminShell>
            <Dashboard />
          </AdminShell>
        }
      />
      <Route
        path="/users"
        element={
          <AdminShell>
            <Users />
          </AdminShell>
        }
      />
      <Route
        path="/posts"
        element={
          <AdminShell>
            <Posts />
          </AdminShell>
        }
      />
      <Route
        path="/reports"
        element={
          <AdminShell>
            <Reports />
          </AdminShell>
        }
      />

      <Route path="/not-admin" element={<NotAdmin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


