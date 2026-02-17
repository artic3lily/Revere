import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";

function toDateSafe(ts) {
  try {
    if (!ts) return null;
    return ts.toDate ? ts.toDate() : new Date(ts);
  } catch {
    return null;
  }
}

function statusNow(u) {
  const st = u.accountStatus || "active";
  if (st === "suspended") {
    const until = toDateSafe(u.suspendedUntil);
    if (until && until.getTime() > Date.now()) return "suspended";
    return "active"; // expired suspension behaves like active
  }
  return st;
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const qRef = query(
          collection(db, "users"),
          orderBy("createdAt", "desc"),
          limit(500)
        );
        const snap = await getDocs(qRef);
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.log("Load users error:", e?.code, e?.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const id = String(u.id || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const username = String(u.username || "").toLowerCase();
      const name = String(u.fullName || "").toLowerCase();
      const role = String(u.role || "").toLowerCase();
      const st = String(statusNow(u)).toLowerCase();
      return (
        id.includes(s) ||
        email.includes(s) ||
        username.includes(s) ||
        name.includes(s) ||
        role.includes(s) ||
        st.includes(s)
      );
    });
  }, [users, search]);

  const updateUser = async (uid, patch) => {
    try {
      setBusyId(uid);
      await setDoc(
        doc(db, "users", uid),
        {
          ...patch,
          statusUpdatedAt: serverTimestamp(),
          statusUpdatedBy: auth.currentUser?.uid || "admin",
        },
        { merge: true }
      );

      // update local list
      setUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, ...patch } : u))
      );
    } catch (e) {
      alert(e?.message || "Update failed (check rules)");
    } finally {
      setBusyId(null);
    }
  };

  const suspend24h = async (u) => {
    const reason = window.prompt("Suspend reason (optional):", u.banReason || "");
    const until = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    await updateUser(u.id, {
      accountStatus: "suspended",
      suspendedUntil: until,
      banReason: reason || "",
    });
  };

  const banUser = async (u) => {
    const ok = window.confirm(`BAN @${u.username || "user"}? (They will be blocked)`);
    if (!ok) return;
    const reason = window.prompt("Ban reason:", u.banReason || "");
    await updateUser(u.id, {
      accountStatus: "banned",
      suspendedUntil: null,
      banReason: reason || "",
    });
  };

  const unban = async (u) => {
    const ok = window.confirm(`Unban/Unsuspend @${u.username || "user"}?`);
    if (!ok) return;
    await updateUser(u.id, {
      accountStatus: "active",
      suspendedUntil: null,
      banReason: "",
    });
  };

  const fmtUntil = (u) => {
    const until = toDateSafe(u.suspendedUntil);
    if (!until) return "—";
    return until.toLocaleString();
  };

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Users</div>
          <div className="pageHint">
            Manage Revere users — ban/suspend/unban.
          </div>
        </div>

        <div className="actionsRow">
          <input
            className="input"
            placeholder="Search by username, email, uid, status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 320 }}
          />
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16 }}>
          <p className="muted">Loading users…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 16 }}>
          <p className="muted">No users found.</p>
        </div>
      ) : (
        <div className="card tableCard">
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th style={{ width: 220 }}>Email</th>
                  <th style={{ width: 120 }}>Role</th>
                  <th style={{ width: 140 }}>Status</th>
                  <th style={{ width: 220 }}>Suspended Until</th>
                  <th style={{ width: 260 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const st = statusNow(u);
                  const isBusy = busyId === u.id;

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 900 }}>
                            @{u.username || "user"}
                          </span>
                          <span className="muted small">
                            {u.fullName || "—"} • {u.id.slice(0, 10)}…
                          </span>
                        </div>
                      </td>

                      <td>{u.email || "—"}</td>
                      <td>{u.role || "user"}</td>

                      <td>
                        <span
                          className={
                            st === "active"
                              ? "pill ok"
                              : st === "suspended"
                              ? "pill warn"
                              : "pill danger"
                          }
                        >
                          {st}
                        </span>
                      </td>

                      <td className="muted">{st === "suspended" ? fmtUntil(u) : "—"}</td>

                      <td>
                        <div className="rowActions">
                          <button
                            className="btnSmall warn"
                            disabled={isBusy || u.role === "admin"}
                            onClick={() => suspend24h(u)}
                            title="Suspend for 24 hours"
                          >
                            {isBusy ? "…" : "Suspend 24h"}
                          </button>

                          <button
                            className="btnSmall danger"
                            disabled={isBusy || u.role === "admin"}
                            onClick={() => banUser(u)}
                            title="Ban user"
                          >
                            {isBusy ? "…" : "Ban"}
                          </button>

                          <button
                            className="btnSmall"
                            disabled={isBusy}
                            onClick={() => unban(u)}
                            title="Unban / unsuspend"
                          >
                            {isBusy ? "…" : "Unban"}
                          </button>
                        </div>

                        {!!u.banReason && (
                          <div className="muted small" style={{ marginTop: 6 }}>
                            Reason: {u.banReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="note">
            Note: Admin accounts can’t be banned/suspended from UI (safety).
          </div>
        </div>
      )}
    </div>
  );
}
