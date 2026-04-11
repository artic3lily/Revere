import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../firebase";

export default function AdminTopBar({ adminUser, onLogout }) {
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [allUsers, setAllUsers] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [fetched, setFetched] = useState(false);
  
  const dropdownRef = useRef(null);

  const display =
    adminUser?.fullName?.trim() ||
    (adminUser?.email ? adminUser.email.split("@")[0] : "Admin");

  // Fetch full lists all in atime this once when they start typing
  useEffect(() => {
    if (searchQuery.trim().length > 0 && !fetched && !loading) {
      setLoading(true);
      const fetchData = async () => {
        try {
          const [usersSnap, postsSnap] = await Promise.all([
            getDocs(query(collection(db, "users"), limit(400))),
            getDocs(query(collection(db, "posts"), limit(400)))
          ]);
          setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setAllPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setFetched(true);
        } catch (e) {
          console.error("Search fetch error", e);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [searchQuery, fetched, loading]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter logic
  const filteredUsers = [];
  const filteredPosts = [];

  if (searchQuery.trim() && fetched) {
    const s = searchQuery.toLowerCase().trim();
    
    // filter users
    for (const u of allUsers) {
      const match = (u.username || "").toLowerCase().includes(s) ||
                    (u.email || "").toLowerCase().includes(s) ||
                    (u.fullName || "").toLowerCase().includes(s);
      if (match) filteredUsers.push(u);
      if (filteredUsers.length >= 5) break; 
    }

    // filter posts
    for (const p of allPosts) {
      const match = (p.caption || "").toLowerCase().includes(s) ||
                    (p.category || "").toLowerCase().includes(s) ||
                    (p.ownerUsername || "").toLowerCase().includes(s);
      if (match) filteredPosts.push(p);
      if (filteredPosts.length >= 5) break;
    }
  }

  const handleUserClick = (u) => {
    setIsFocused(false);
    setSearchQuery("");
    navigate("/users", { state: { openUserId: u.id } });
  };

  const handlePostClick = (p) => {
    setIsFocused(false);
    setSearchQuery("");
    navigate("/posts", { state: { openPostId: p.id } });
  };

  return (
    <header className="topbar">
      <div className="topLeft">
        <div className="topTitle">Control Center</div>
        <div className="topHint">Monitor Revere activity & moderate safely</div>
      </div>

      <div className="topRight">
        <div className="searchBox" ref={dropdownRef} style={{ position: "relative" }}>
          <span className="searchIcon">⌕</span>
          <input 
            placeholder="Quick search users or posts…" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
          />
          
          {/* Dropdown Menu */}
          {isFocused && searchQuery.trim().length > 0 && (
            <div className="searchDropdown">
              {loading && !fetched ? (
                <div className="searchSection" style={{ padding: 12, textAlign: "center", color: "#888" }}>
                  Loading records…
                </div>
              ) : (
                <>
                  {filteredUsers.length > 0 && (
                    <div className="searchSection">
                      <div className="searchSectionTitle">Users</div>
                      {filteredUsers.map(u => (
                        <div key={u.id} className="searchItem" onClick={() => handleUserClick(u)}>
                          <div className="searchItemName">@{u.username || "user"}</div>
                          <div className="searchItemSub">{u.email || "No email"}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredPosts.length > 0 && (
                    <div className="searchSection" style={{ borderTop: filteredUsers.length > 0 ? "1px solid var(--border)" : "none", paddingTop: filteredUsers.length > 0 ? 8 : 0 }}>
                      <div className="searchSectionTitle">Posts</div>
                      {filteredPosts.map(p => (
                        <div key={p.id} className="searchItem" onClick={() => handlePostClick(p)}>
                          <div className="searchItemName">{p.caption || "Untitled post"}</div>
                          <div className="searchItemSub">by @{p.ownerUsername || "seller"}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredUsers.length === 0 && filteredPosts.length === 0 && fetched && (
                    <div className="searchSection" style={{ padding: 12, textAlign: "center", color: "#888", fontSize: 13 }}>
                      No results found for "{searchQuery}"
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
