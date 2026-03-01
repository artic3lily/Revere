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
import { useLocation } from "react-router-dom";

/* helpers */
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
    return "active";
  }
  return st;
}

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fmtDate(ts) {
  const d = toDateSafe(ts);
  if (!d) return "—";
  return d.toLocaleString();
}

function initials(nameOrUsername) {
  const s = String(nameOrUsername || "").trim();
  if (!s) return "U";
  const parts = s.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Users() {
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(location.state?.search || "");
  const [busyId, setBusyId] = useState(null);

  /*Details modal*/
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);

  /*Action modal (ban/suspend/restore)*/
  const [actionOpen, setActionOpen] = useState(false);
  const [modalMode, setModalMode] = useState("suspend"); // "suspend" | "ban" | "restore"
  const [targetUser, setTargetUser] = useState(null);
  const [reason, setReason] = useState("");

  // suspend time selection
  const [timeMode, setTimeMode] = useState("custom"); // custom | exact
  const [customValue, setCustomValue] = useState("24");
  const [customUnit, setCustomUnit] = useState("hours"); // minutes | hours | days
  const [exactUntil, setExactUntil] = useState(
    toDatetimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );

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

      setUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, ...patch } : u))
      );

      // keep detail modal in sync if open
      setDetailUser((prev) => (prev?.id === uid ? { ...prev, ...patch } : prev));
    } catch (e) {
      alert(e?.message || "Update failed (check rules)");
    } finally {
      setBusyId(null);
    }
  };

  const fmtUntil = (u) => {
    const until = toDateSafe(u.suspendedUntil);
    if (!until) return "—";
    return until.toLocaleString();
  };

  /*Details modal open/close */
  const openDetails = (u) => {
    setDetailUser(u);
    setDetailOpen(true);
  };

  const closeDetails = () => {
    setDetailOpen(false);
    setDetailUser(null);
  };

  /*Action modal open/close */
  const openAction = (u, mode) => {
    // no action here, only open modal
    setTargetUser(u);
    setModalMode(mode);
    setReason("");

    // reset timeframe
    setTimeMode("custom");
    setCustomValue("24");
    setCustomUnit("hours");
    setExactUntil(toDatetimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));

    setActionOpen(true);
  };

  const closeAction = () => {
    setActionOpen(false);
    setTargetUser(null);
    setReason("");
  };

  const computeSuspendUntilTimestamp = () => {
    try {
      if (timeMode === "exact") {
        const dt = new Date(exactUntil);
        if (Number.isNaN(dt.getTime())) return null;
        if (dt.getTime() <= Date.now()) return null;
        return Timestamp.fromDate(dt);
      }

      // custom
      const n = parseInt(customValue || "0", 10);
      if (!n || n <= 0) return null;

      let ms = n * 60 * 1000;
      if (customUnit === "hours") ms = n * 60 * 60 * 1000;
      if (customUnit === "days") ms = n * 24 * 60 * 60 * 1000;

      const dt = new Date(Date.now() + ms);
      return Timestamp.fromDate(dt);
    } catch {
      return null;
    }
  };

  const confirmAction = async () => {
    const u = targetUser;
    if (!u?.id) return;

    if (u.role === "admin") {
      alert("Admin accounts can’t be banned/suspended.");
      return;
    }

    // require reason for ban/suspend
    if ((modalMode === "ban" || modalMode === "suspend") && reason.trim().length < 3) {
      alert("Please enter a reason (at least 3 characters).");
      return;
    }

    if (modalMode === "suspend") {
      const untilTs = computeSuspendUntilTimestamp();
      if (!untilTs) {
        alert("Please choose a valid suspend duration or a future date/time.");
        return;
      }

      await updateUser(u.id, {
        accountStatus: "suspended",
        suspendedUntil: untilTs,
        banReason: reason.trim(),
        moderation: {
          action: "suspend",
          reason: reason.trim(),
          by: auth.currentUser?.uid || "admin",
          at: serverTimestamp(),
        },
      });

      closeAction();
      return;
    }

    if (modalMode === "ban") {
      await updateUser(u.id, {
        accountStatus: "banned",
        suspendedUntil: null,
        banReason: reason.trim(),
        moderation: {
          action: "ban",
          reason: reason.trim(),
          by: auth.currentUser?.uid || "admin",
          at: serverTimestamp(),
        },
      });

      closeAction();
      return;
    }

    if (modalMode === "restore") {
      await updateUser(u.id, {
        accountStatus: "active",
        suspendedUntil: null,
        banReason: "",
        moderation: {
          action: "restore",
          reason: reason.trim() || "Restored by admin",
          by: auth.currentUser?.uid || "admin",
          at: serverTimestamp(),
        },
      });

      closeAction();
      return;
    }
  };

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Users</div>
          <div className="pageHint">Click a user to view full details, then suspend/ban/restore.</div>
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
                  <th style={{ width: 320 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((u) => {
                  const st = statusNow(u);
                  const isBusy = busyId === u.id;

                  return (
                    <tr
                      key={u.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => openDetails(u)}
                      title="Click to view user details"
                    >
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 900 }}>
                            @{u.username || "user"}
                          </span>
                          <span className="muted small">
                            {u.fullName || "—"} • {u.id?.slice?.(0, 10)}…
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

                      <td className="muted">
                        {st === "suspended" ? fmtUntil(u) : "—"}
                      </td>

                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="rowActions">
                          <button
                            className="btnSmall warn"
                            disabled={isBusy || u.role === "admin"}
                            onClick={() => openAction(u, "suspend")}
                            title="Suspend user (choose time)"
                          >
                            {isBusy ? "…" : "Suspend"}
                          </button>

                          <button
                            className="btnSmall danger"
                            disabled={isBusy || u.role === "admin"}
                            onClick={() => openAction(u, "ban")}
                            title="Ban user (with reason)"
                          >
                            {isBusy ? "…" : "Ban"}
                          </button>

                          <button
                            className="btnSmall"
                            disabled={isBusy}
                            onClick={() => openAction(u, "restore")}
                            title="Restore (unban/unsuspend)"
                          >
                            {isBusy ? "…" : "Restore"}
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

          <div className="note">Note: Admin accounts cannot be banned/suspended.</div>
        </div>
      )}

      {/* details modal */}
      {detailOpen && detailUser && (
        <div className="modalBackdrop" onClick={closeDetails}>
          <div className="modalCard modalCardWide" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div>
                <div className="modalTitle" style={{ fontWeight: 900 }}>User Details</div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  @{detailUser.username || "user"} • {detailUser.email || "—"}
                </div>
              </div>

              <button className="btnGhost" onClick={closeDetails}>Close</button>
            </div>

            <div className="modalBody" style={{ padding: 16 }}>
              <div className="userDetailGrid">
                {/* left card */}
                <div className="card" style={{ padding: 14 }}>
                  <div className="userHeader">
                    <div className="userAvatar">
                      {initials(detailUser.fullName || detailUser.username)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="userName">
                        {detailUser.fullName || "—"}
                      </div>
                      <div className="muted small">
                        @{detailUser.username || "user"} • {detailUser.role || "user"}
                      </div>
                    </div>

                    <span
                      className={
                        statusNow(detailUser) === "active"
                          ? "pill ok"
                          : statusNow(detailUser) === "suspended"
                            ? "pill warn"
                            : "pill danger"
                      }
                    >
                      {statusNow(detailUser)}
                    </span>
                  </div>

                  <div className="kvList" style={{ marginTop: 12 }}>
                    <div className="kv">
                      <div className="k">UID</div>
                      <div className="v mono">{detailUser.id}</div>
                    </div>
                    <div className="kv">
                      <div className="k">Email</div>
                      <div className="v">{detailUser.email || "—"}</div>
                    </div>
                    <div className="kv">
                      <div className="k">Joined</div>
                      <div className="v">{fmtDate(detailUser.createdAt)}</div>
                    </div>
                    <div className="kv">
                      <div className="k">Suspended Until</div>
                      <div className="v">
                        {statusNow(detailUser) === "suspended" ? fmtUntil(detailUser) : "—"}
                      </div>
                    </div>
                    <div className="kv">
                      <div className="k">Reason</div>
                      <div className="v">{detailUser.banReason || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* right card */}
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Moderation</div>
                  <div className="muted small" style={{ marginBottom: 12 }}>
                    Choose an action. Ban/Suspend will require a reason and confirmation.
                  </div>

                  <div className="rowActions">
                    <button
                      className="btnSmall warn"
                      disabled={detailUser.role === "admin" || busyId === detailUser.id}
                      onClick={() => openAction(detailUser, "suspend")}
                    >
                      Suspend
                    </button>
                    <button
                      className="btnSmall danger"
                      disabled={detailUser.role === "admin" || busyId === detailUser.id}
                      onClick={() => openAction(detailUser, "ban")}
                    >
                      Ban
                    </button>
                    <button
                      className="btnSmall"
                      disabled={busyId === detailUser.id}
                      onClick={() => openAction(detailUser, "restore")}
                    >
                      Restore
                    </button>
                  </div>

                  <div className="note" style={{ marginTop: 12 }}>
                    You are about to ban or suspend the user.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* action modal */}
      {actionOpen && targetUser && (
        <div className="modalBackdrop" onClick={closeAction}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div>
                <div className="modalTitle" style={{ fontWeight: 900 }}>
                  {modalMode === "suspend" && "Suspend User"}
                  {modalMode === "ban" && "Ban User"}
                  {modalMode === "restore" && "Restore User"}
                </div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  @{targetUser.username || "user"} • {targetUser.email || "—"} • {targetUser.id}
                </div>
              </div>

              <button className="btnGhost" onClick={closeAction}>Cancel</button>
            </div>

            <div className="modalBody" style={{ padding: 16 }}>
              {(modalMode === "ban" || modalMode === "suspend") && (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <div className="muted small" style={{ fontWeight: 900, marginBottom: 6 }}>
                      Reason (required)
                    </div>
                    <input
                      className="input"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Write a clear reason…"
                    />
                  </div>

                  {modalMode === "suspend" && (
                    <div className="card" style={{ padding: 12, marginTop: 12 }}>
                      <div style={{ fontWeight: 900, marginBottom: 8 }}>
                        Suspension timeframe
                      </div>

                      {/* mode tabs */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className={"btnSmall" + (timeMode === "custom" ? " activeTab" : "")}
                          onClick={() => setTimeMode("custom")}
                        >
                          Custom
                        </button>
                        <button
                          type="button"
                          className={"btnSmall" + (timeMode === "exact" ? " activeTab" : "")}
                          onClick={() => setTimeMode("exact")}
                        >
                          Exact date/time
                        </button>
                      </div>

                      {/* custom duration */}
                      {timeMode === "custom" && (
                        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <input
                            className="input"
                            style={{ width: 140 }}
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            placeholder="Number"
                          />
                          <select
                            className="input"
                            style={{ width: 170 }}
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value)}
                          >
                            <option value="minutes">minutes</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                          </select>
                        </div>
                      )}

                      {/* exact date/time */}
                      {timeMode === "exact" && (
                        <div style={{ marginTop: 10 }}>
                          <input
                            className="input"
                            type="datetime-local"
                            value={exactUntil}
                            onChange={(e) => setExactUntil(e.target.value)}
                          />
                          <div className="muted small" style={{ marginTop: 6 }}>
                            Choose a future date/time.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {modalMode === "restore" && (
                <div style={{ marginBottom: 10 }}>
                  <div className="muted small" style={{ fontWeight: 900, marginBottom: 6 }}>
                    Optional note
                  </div>
                  <input
                    className="input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Optional…"
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button className="btnGhost" onClick={closeAction}>Cancel</button>

                <button
                  className={modalMode === "ban" ? "btnDanger" : "btnPrimary"}
                  onClick={confirmAction}
                >
                  Confirm
                </button>
              </div>

              <div className="muted small" style={{ marginTop: 10 }}>
                Important: You are about ban or suspend the user.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}