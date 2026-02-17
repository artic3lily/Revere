// admin-dashboard/src/pages/Posts.jsx
import React, { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

export default function Posts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Load posts
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(200));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPosts(list);
      } catch (e) {
        console.log("Load posts error:", e?.message || e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return posts;

    return posts.filter((p) => {
      const owner = String(p.ownerUsername || "").toLowerCase();
      const caption = String(p.caption || "").toLowerCase();
      const category = String(p.category || "").toLowerCase();
      const tags = Array.isArray(p.tags) ? p.tags.join(" ").toLowerCase() : "";
      return (
        owner.includes(s) ||
        caption.includes(s) ||
        category.includes(s) ||
        tags.includes(s) ||
        String(p.ownerId || "").toLowerCase().includes(s)
      );
    });
  }, [posts, search]);

  const fmtDate = (ts) => {
    try {
      if (!ts) return "—";
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString();
    } catch {
      return "—";
    }
  };

  const onDeletePost = async (post) => {
    if (!post?.id) return;
    const ok = window.confirm("Delete this post? (This cannot be undone)");
    if (!ok) return;

    try {
      setDeleting(true);
      await deleteDoc(doc(db, "posts", post.id));
      setPosts((prev) => prev.filter((x) => x.id !== post.id));
      setSelected(null);
      alert("Post deleted ✅");
    } catch (e) {
      alert(e?.message || "Delete failed (check rules)");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2 className="h2">Posts</h2>
          <p className="muted">View all listings uploaded in Revere. Click a card to open full detail.</p>
        </div>

        <div className="actionsRow">
          <input
            className="input"
            placeholder="Search by caption, user, tag, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 320 }}
          />
        </div>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="card" style={{ padding: 16 }}>
          <p className="muted">Loading posts…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 16 }}>
          <p className="muted">No posts found.</p>
        </div>
      ) : (
        <div className="postsGrid">
          {filtered.map((p) => (
            <button
              key={p.id}
              className="postCard"
              onClick={() => setSelected(p)}
              title="Open details"
              type="button"
            >
              <div className="postThumbWrap">
                {p.imageUrl ? (
                  <img className="postThumb" src={p.imageUrl} alt="post" loading="lazy" />
                ) : (
                  <div className="postThumbPh">No image</div>
                )}
              </div>

              <div className="postBody">
                <div className="postRow1">
                  <div className="postCaption" title={p.caption || ""}>
                    {p.caption?.trim()?.length ? p.caption : "—"}
                  </div>
                  <div className="postPrice">
                    {typeof p.price === "number" ? `Rs. ${p.price}` : "—"}
                  </div>
                </div>

                <div className="postMetaRow">
                  <span className="postPill">{p.category || "—"}</span>
                  <span className="postUser">@{p.ownerUsername || "user"}</span>
                </div>

                <div className="postTags">
                  {Array.isArray(p.tags) && p.tags.length > 0
                    ? p.tags.slice(0, 3).map((t) => `#${t}`).join(" ")
                    : ""}
                </div>

                <div className="postDate muted">{fmtDate(p.createdAt || p.clientCreatedAt)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* MODAL */}
      {selected && (
        <div className="modalBackdrop" onClick={() => setSelected(null)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div>
                <div className="modalTitle">Post Details</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  @{selected.ownerUsername || "user"} • {selected.id}
                </div>
              </div>

              <button className="btnGhost" onClick={() => setSelected(null)} type="button">
                Close
              </button>
            </div>

            <div className="modalBody">
              {/* Left: Image */}
              <div className="detailImageWrap">
                {selected.imageUrl ? (
                  <img className="detailImage" src={selected.imageUrl} alt="post" />
                ) : (
                  <div className="detailImagePh">No image</div>
                )}
              </div>

              {/* Right: Info */}
              <div className="detailInfo">
                <div className="pillRow">
                  {typeof selected.price === "number" && (
                    <span className="pillDark">Rs. {selected.price}</span>
                  )}
                  {selected.category && <span className="pill">{selected.category}</span>}
                </div>

                <div className="detailBlock">
                  <div className="label">Caption</div>
                  <div className="value">{selected.caption?.trim()?.length ? selected.caption : "—"}</div>
                </div>

                <div className="detailBlock">
                  <div className="label">Tags</div>
                  <div className="value">
                    {Array.isArray(selected.tags) && selected.tags.length > 0
                      ? selected.tags.map((t) => `#${t}`).join(" ")
                      : "—"}
                  </div>
                </div>

                <div className="detailBlock">
                  <div className="label">Owner</div>
                  <div className="value">
                    @{selected.ownerUsername || "user"} • {selected.ownerId || "—"}
                  </div>
                </div>

                <div className="detailBlock">
                  <div className="label">Created</div>
                  <div className="value">{fmtDate(selected.createdAt || selected.clientCreatedAt)}</div>
                </div>

                <div className="detailActions">
                  <button
                    className="btnDanger"
                    onClick={() => onDeletePost(selected)}
                    disabled={deleting}
                    type="button"
                    title="Delete post from Firestore"
                  >
                    {deleting ? "Deleting…" : "Delete Post"}
                  </button>
                </div>

                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Tip: need to add more info
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
