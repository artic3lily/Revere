import React, { useEffect, useMemo, useState } from "react";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";

/* Helpers */
function toDateSafe(ts) {
    try {
        if (!ts) return null;
        return ts.toDate ? ts.toDate() : new Date(ts);
    } catch {
        return null;
    }
}

function fmtDate(ts) {
    const d = toDateSafe(ts);
    if (!d) return "—";
    return d.toLocaleString();
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

export default function Reports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [busyId, setBusyId] = useState(null);

    /* User Info Cache */
    const [userCache, setUserCache] = useState({});

    /* Details modal */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailReport, setDetailReport] = useState(null);
    const [zoomedImage, setZoomedImage] = useState(null);

    /* Action modal (ban/suspend) */
    const [actionOpen, setActionOpen] = useState(false);
    const [modalMode, setModalMode] = useState("suspend"); // "suspend" | "ban"
    const [targetUserId, setTargetUserId] = useState(null);
    const [reason, setReason] = useState("");

    // suspend time selection
    const [timeMode, setTimeMode] = useState("custom");
    const [customValue, setCustomValue] = useState("24");
    const [customUnit, setCustomUnit] = useState("hours");
    const [exactUntil, setExactUntil] = useState(
        toDatetimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000))
    );

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const qRef = query(
                collection(db, "reports"),
                orderBy("createdAt", "desc"),
                limit(500)
            );
            const snap = await getDocs(qRef);
            const reportsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setReports(reportsList);

            // Collect unique user IDs to fetch their usernames/names
            const uidsToFetch = new Set();
            reportsList.forEach(r => {
                if (r.reporterId) uidsToFetch.add(r.reporterId);
                if (r.reportedUserId) uidsToFetch.add(r.reportedUserId);
            });

            // Fetch user data
            const newCache = { ...userCache };
            for (const uid of uidsToFetch) {
                if (!newCache[uid]) {
                    try {
                        const userSnap = await getDoc(doc(db, "users", uid));
                        if (userSnap.exists()) {
                            newCache[uid] = userSnap.data();
                        } else {
                            newCache[uid] = { username: "unknown", fullName: "Unknown User" };
                        }
                    } catch (e) {
                        console.log("Error fetching user", uid);
                    }
                }
            }
            setUserCache(newCache);
        } catch (e) {
            console.log("Load reports error:", e?.code, e?.message);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase();
        if (!s) return reports;
        return reports.filter((r) => {
            const id = String(r.id || "").toLowerCase();
            const reason = String(r.reason || "").toLowerCase();
            const st = String(r.status || "").toLowerCase();

            const reporter = userCache[r.reporterId];
            const reported = userCache[r.reportedUserId];

            const repName = reporter ? String(reporter.username || "").toLowerCase() : "";
            const reportedName = reported ? String(reported.username || "").toLowerCase() : "";

            return (
                id.includes(s) ||
                reason.includes(s) ||
                st.includes(s) ||
                repName.includes(s) ||
                reportedName.includes(s)
            );
        });
    }, [reports, search, userCache]);

    const updateReportStatus = async (reportId, newStatus) => {
        try {
            await setDoc(
                doc(db, "reports", reportId),
                { status: newStatus },
                { merge: true }
            );

            setReports((prev) =>
                prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
            );

            if (detailReport?.id === reportId) {
                setDetailReport(prev => ({ ...prev, status: newStatus }));
            }
        } catch (e) {
            console.log("Update report status failed", e);
        }
    };

    /* Details Modal */
    const openDetails = (r) => {
        setDetailReport(r);
        setDetailOpen(true);
        // Auto mark as reviewed if it's pending
        if (r.status === "pending") {
            updateReportStatus(r.id, "reviewed");
        }
    };

    const closeDetails = () => {
        setDetailOpen(false);
        setDetailReport(null);
    };

    const openAction = (r, mode) => {
        setTargetUserId(r.reportedUserId);
        setModalMode(mode);
        setReason("");

        setTimeMode("custom");
        setCustomValue("24");
        setCustomUnit("hours");
        setExactUntil(toDatetimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));

        setActionOpen(true);
    };

    const closeAction = () => {
        setActionOpen(false);
        setTargetUserId(null);
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
            const n = parseInt(customValue || "0", 10);
            if (!n || n <= 0) return null;
            let ms = n * 60 * 1000;
            if (customUnit === "hours") ms = n * 60 * 60 * 1000;
            if (customUnit === "days") ms = n * 24 * 60 * 60 * 1000;
            return Timestamp.fromDate(new Date(Date.now() + ms));
        } catch {
            return null;
        }
    };

    const confirmAction = async () => {
        if (!targetUserId) return;
        if (reason.trim().length < 3) {
            alert("Please enter a reason.");
            return;
        }

        try {
            setBusyId(targetUserId);
            const userDoc = doc(db, "users", targetUserId);
            const snap = await getDoc(userDoc);
            if (snap.exists() && snap.data().role === "admin") {
                alert("Cannot ban/suspend an admin.");
                setBusyId(null);
                return;
            }

            let patchInfo = {};

            if (modalMode === "suspend") {
                const untilTs = computeSuspendUntilTimestamp();
                if (!untilTs) {
                    alert("Please choose a valid suspend duration.");
                    setBusyId(null);
                    return;
                }
                patchInfo = {
                    accountStatus: "suspended",
                    suspendedUntil: untilTs,
                    banReason: reason.trim(),
                    moderation: {
                        action: "suspend",
                        reason: reason.trim(),
                        by: auth.currentUser?.uid || "admin",
                        at: serverTimestamp(),
                    },
                };
            } else if (modalMode === "ban") {
                patchInfo = {
                    accountStatus: "banned",
                    suspendedUntil: null,
                    banReason: reason.trim(),
                    moderation: {
                        action: "ban",
                        reason: reason.trim(),
                        by: auth.currentUser?.uid || "admin",
                        at: serverTimestamp(),
                    },
                };
            }

            await setDoc(
                doc(db, "users", targetUserId),
                {
                    ...patchInfo,
                    statusUpdatedAt: serverTimestamp(),
                    statusUpdatedBy: auth.currentUser?.uid || "admin",
                },
                { merge: true }
            );

            // Mark associated reports as actionable
            reports.filter(r => r.reportedUserId === targetUserId && r.status !== "action_taken").forEach(r => {
                updateReportStatus(r.id, "action_taken");
            });

            closeAction();
            alert(`User has been ${modalMode}ed successfully.`);
        } catch (e) {
            alert("Action failed: " + e.message);
        } finally {
            setBusyId(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "pending": return "pill danger";
            case "reviewed": return "pill warn";
            case "action_taken": return "pill ok";
            default: return "pill";
        }
    };

    const formatSt = (status) => {
        switch (status) {
            case "pending": return "Pending";
            case "reviewed": return "Reviewed";
            case "action_taken": return "Action Taken";
            default: return status || "Unknown";
        }
    };

    return (
        <div className="page">
            <div className="pageHeader">
                <div>
                    <div className="pageTitle">Reports</div>
                    <div className="pageHint">Review community reports and take moderation actions.</div>
                </div>

                <div className="actionsRow">
                    <input
                        className="input"
                        placeholder="Search reasons, users, status…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ minWidth: 320 }}
                    />
                </div>
            </div>

            {loading ? (
                <div className="card" style={{ padding: 16 }}>
                    <p className="muted">Loading reports…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="card" style={{ padding: 16 }}>
                    <p className="muted">No reports found.</p>
                </div>
            ) : (
                <div className="card tableCard">
                    <div className="tableWrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: 140 }}>Date</th>
                                    <th style={{ width: 160 }}>Reporter</th>
                                    <th style={{ width: 160 }}>Reported User</th>
                                    <th>Reason</th>
                                    <th style={{ width: 120 }}>Status</th>
                                    <th style={{ width: 180 }}>Quick Action</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filtered.map((r) => {
                                    const reporter = userCache[r.reporterId];
                                    const reported = userCache[r.reportedUserId];
                                    const isBusy = busyId === r.reportedUserId;

                                    return (
                                        <tr
                                            key={r.id}
                                            style={{ cursor: "pointer" }}
                                            onClick={() => openDetails(r)}
                                            title="Click to view full report evidence"
                                        >
                                            <td className="muted small">{fmtDate(r.createdAt)}</td>

                                            <td>
                                                <div style={{ display: "flex", flexDirection: "column" }}>
                                                    <span style={{ fontWeight: 600 }}>
                                                        @{reporter?.username || "..."}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>
                                                <div style={{ display: "flex", flexDirection: "column" }}>
                                                    <span style={{ fontWeight: 900, color: "#d32f2f" }}>
                                                        @{reported?.username || "..."}
                                                    </span>
                                                    <span className="muted small">{r.reportedUserId?.slice(0, 8)}…</span>
                                                </div>
                                            </td>

                                            <td>{r.reason}</td>

                                            <td>
                                                <span className={getStatusColor(r.status)}>
                                                    {formatSt(r.status)}
                                                </span>
                                            </td>

                                            <td onClick={(e) => e.stopPropagation()}>
                                                <div className="rowActions">
                                                    <button
                                                        className="btnSmall warn"
                                                        disabled={isBusy}
                                                        onClick={() => openAction(r, "suspend")}
                                                        title="Suspend reported user"
                                                    >
                                                        Suspend
                                                    </button>
                                                    <button
                                                        className="btnSmall danger"
                                                        disabled={isBusy}
                                                        onClick={() => openAction(r, "ban")}
                                                        title="Ban reported user"
                                                    >
                                                        Ban
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {detailOpen && detailReport && (
                <div className="modalBackdrop" onClick={closeDetails}>
                    <div className="modalCard modalCardWide" onClick={(e) => e.stopPropagation()}>
                        <div className="modalTop">
                            <div>
                                <div className="modalTitle" style={{ fontWeight: 900 }}>Report Details</div>
                                <div className="muted small" style={{ marginTop: 6 }}>
                                    Submitted: {fmtDate(detailReport.createdAt)}
                                </div>
                            </div>
                            <button className="btnGhost" onClick={closeDetails}>Close</button>
                        </div>

                        <div className="modalBody" style={{ padding: 16, overflowY: "auto", maxHeight: "70vh" }}>
                            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
                                <div className="kvList">
                                    <div className="kv">
                                        <div className="k">Reporter</div>
                                        <div className="v">@{userCache[detailReport.reporterId]?.username || "Unknown"}</div>
                                    </div>
                                    <div className="kv">
                                        <div className="k">Reported User</div>
                                        <div className="v" style={{ color: "#d32f2f", fontWeight: "bold" }}>
                                            @{userCache[detailReport.reportedUserId]?.username || "Unknown"}
                                        </div>
                                    </div>
                                    <div className="kv">
                                        <div className="k">Reason given</div>
                                        <div className="v" style={{ fontWeight: "bold" }}>{detailReport.reason}</div>
                                    </div>
                                    <div className="kv">
                                        <div className="k">Current Status</div>
                                        <div className="v">
                                            <span className={getStatusColor(detailReport.status)}>
                                                {formatSt(detailReport.status)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
                                <div style={{ fontWeight: 900, marginBottom: 8 }}>Comment from Reporter</div>
                                {detailReport.comment ? (
                                    <p style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", color: "#111", padding: 12, borderRadius: 8 }}>
                                        {detailReport.comment}
                                    </p>
                                ) : (
                                    <p className="muted small">No comments provided.</p>
                                )}
                            </div>

                            {detailReport.evidenceUrl && (
                                <div className="card" style={{ padding: 14 }}>
                                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Evidence Uploaded</div>
                                    <img
                                        src={detailReport.evidenceUrl}
                                        alt="Report Evidence"
                                        onClick={() => setZoomedImage(detailReport.evidenceUrl)}
                                        style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, objectFit: "contain", border: "1px solid #eee", cursor: "zoom-in" }}
                                    />
                                </div>
                            )}


                        </div>
                    </div>
                </div>
            )}

            {/* Action Modal (copied from Users.jsx flow) */}
            {actionOpen && targetUserId && (
                <div className="modalBackdrop" onClick={closeAction}>
                    <div className="modalCard" onClick={(e) => e.stopPropagation()}>
                        <div className="modalTop">
                            <div>
                                <div className="modalTitle" style={{ fontWeight: 900 }}>
                                    {modalMode === "suspend" && "Suspend User"}
                                    {modalMode === "ban" && "Ban User"}
                                </div>
                                <div className="muted small" style={{ marginTop: 6 }}>
                                    @{userCache[targetUserId]?.username || "user"} • {targetUserId}
                                </div>
                            </div>
                            <button className="btnGhost" onClick={closeAction}>Cancel</button>
                        </div>

                        <div className="modalBody" style={{ padding: 16 }}>
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
                                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Suspension timeframe</div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <button
                                            type="button"
                                            className={"btnSmall" + (timeMode === "custom" ? " activeTab" : "")}
                                            onClick={() => setTimeMode("custom")}
                                        >Custom</button>
                                        <button
                                            type="button"
                                            className={"btnSmall" + (timeMode === "exact" ? " activeTab" : "")}
                                            onClick={() => setTimeMode("exact")}
                                        >Exact date/time</button>
                                    </div>

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

                                    {timeMode === "exact" && (
                                        <div style={{ marginTop: 10 }}>
                                            <input
                                                className="input"
                                                type="datetime-local"
                                                value={exactUntil}
                                                onChange={(e) => setExactUntil(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                                <button className="btnGhost" onClick={closeAction}>Cancel</button>
                                <button
                                    className={modalMode === "ban" ? "btnDanger" : "btnPrimary"}
                                    onClick={confirmAction}
                                    disabled={busyId === targetUserId}
                                >
                                    {busyId === targetUserId ? "Processing..." : "Confirm"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Zoomed Image Lightbox */}
            {zoomedImage && (
                <div
                    className="modalBackdrop"
                    style={{ zIndex: 9999, padding: 20, backgroundColor: "rgba(0,0,0,0.8)" }}
                    onClick={() => setZoomedImage(null)}
                >
                    <button
                        style={{ position: "absolute", top: 20, right: 30, background: "none", border: "none", color: "white", fontSize: 24, fontWeight: "bold", cursor: "pointer" }}
                        onClick={() => setZoomedImage(null)}
                    >
                        ✕
                    </button>
                    <img
                        src={zoomedImage}
                        alt="Zoomed Evidence"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            cursor: "default"
                        }}
                    />
                </div>
            )}
        </div>
    );
}
