import React from "react";

export default function AdminTopBar({ adminUser, onLogout }) {
  const display =
    adminUser?.fullName?.trim() ||
    (adminUser?.email ? adminUser.email.split("@")[0] : "Admin");

  return (
    <header className="topbar">
      <div className="topLeft">
        <div className="topTitle">Control Center</div>
        <div className="topHint">Monitor Revere activity & moderate safely</div>
      </div>

      <div className="topRight">
        <div className="searchBox">
          <span className="searchIcon">⌕</span>
          <input placeholder="Search users, posts, keywords…" />
        </div>

        <div className="adminChip">
          <div className="adminAvatar">{String(display).slice(0, 1).toUpperCase()}</div>
          <div className="adminMeta">
            <div className="adminName">{display}</div>
            <div className="adminRole">Admin</div>
          </div>
        </div>

        <button className="btnGhost" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
