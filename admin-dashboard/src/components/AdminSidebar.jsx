import React from "react";
import { Link } from "react-router-dom";

export default function AdminSidebar({ activePath }) {
  const Item = ({ to, label, icon }) => {
    const active = activePath === to;
    return (
      <Link className={`sideItem ${active ? "active" : ""}`} to={to}>
        <span className="sideIcon">{icon}</span>
        <span className="sideLabel">{label}</span>
      </Link>
    );
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">R</div>
        <div>
          <div className="brandName">Revere</div>
          <div className="brandSub">Admin Console</div>
        </div>
      </div>

      <div className="sideSectionTitle">Manage</div>
      <nav className="sideNav">
        <Item to="/" label="Dashboard" icon="📊" />
        <Item to="/users" label="Users" icon="👥" />
        <Item to="/posts" label="Posts" icon="🧥" />
        <Item to="/reports" label="Reports" icon="🚩" />
      </nav>

      <div className="sideFooter">
        <div className="tipCard">
          <div className="tipTitle">Moderation Tip</div>
          <div className="tipText">
            Review suspicious posts and suspend users who violate rules.
          </div>
        </div>
      </div>
    </aside>
  );
}
