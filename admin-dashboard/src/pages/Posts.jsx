// admin-dashboard/src/pages/Posts.jsx
import React, { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, collectionGroup } from "firebase/firestore";
import { db } from "../firebase";

export default function Posts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);
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

      // 1. Delete the post itself
      await deleteDoc(doc(db, "posts", post.id));

      // 2. Cascade delete from all users' carts
      try {
        const cartQ = query(collectionGroup(db, "cart"));
        const cartSnap = await getDocs(cartQ);
        const batchDeletes = [];
        cartSnap.forEach((d) => {
          if (d.id === post.id || d.data().postId === post.id) {
            batchDeletes.push(deleteDoc(d.ref));
          }
        });
        await Promise.all(batchDeletes);
      } catch (e) {
        console.log("Failed to clean up carts:", e);
      }

      // 3. Cascade delete from all users' wishlists
      try {
        const wishlistQ = query(collectionGroup(db, "wishlist"));
        const wishlistSnap = await getDocs(wishlistQ);
        const batchDeletes = [];
        wishlistSnap.forEach((d) => {
          if (d.id === post.id || d.data().postId === post.id) {
            batchDeletes.push(deleteDoc(d.ref));
          }
        });
        await Promise.all(batchDeletes);
      } catch (e) {
        console.log("Failed to clean up wishlists:", e);
      }

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
          <div className="modalCard modalCardWide" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div>
                <div className="modalTitle" style={{ fontWeight: 900 }}>Post Details</div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  Posted: {fmtDate(selected.createdAt || selected.clientCreatedAt)}
                </div>
              </div>

              <button className="btnGhost" onClick={() => setSelected(null)} type="button">
                Close
              </button>
            </div>

            <div className="modalBody" style={{ padding: 16, overflowY: "auto", maxHeight: "70vh" }}>

              {/* Top Details Card */}
              <div className="card" style={{ padding: 14, marginBottom: 16 }}>
                <div className="kvList">
                  <div className="kv">
                    <div className="k">Seller</div>
                    <div className="v" style={{ fontWeight: 600 }}>@{selected.ownerUsername || "user"}</div>
                  </div>
                  <div className="kv">
                    <div className="k">Category</div>
                    <div className="v">
                      <span className="pill">{selected.category || "—"}</span>
                    </div>
                  </div>
                  <div className="kv">
                    <div className="k">Price</div>
                    <div className="v" style={{ fontWeight: "bold", color: "#fff" }}>
                      {typeof selected.price === "number" ? `Rs. ${selected.price}` : "—"}
                    </div>
                  </div>
                  <div className="kv">
                    <div className="k">Tags</div>
                    <div className="v">
                      {Array.isArray(selected.tags) && selected.tags.length > 0
                        ? selected.tags.map((t) => `#${t}`).join(" ")
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Caption Card */}
              <div className="card" style={{ padding: 14, marginBottom: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Caption</div>
                <p style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", color: "#111", padding: 12, borderRadius: 8, margin: 0 }}>
                  {selected.caption?.trim()?.length ? selected.caption : "No caption provided."}
                </p>
              </div>

              {/* Image Card */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Product Image</div>
                {selected.imageUrl ? (
                  <img
                    src={selected.imageUrl}
                    alt="Product"
                    onClick={() => setZoomedImage(selected.imageUrl)}
                    style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8, objectFit: "contain", border: "1px solid #eee", cursor: "zoom-in" }}
                  />
                ) : (
                  <p className="muted small">No image uploaded.</p>
                )}
              </div>

              <div className="rowActions" style={{ marginTop: 24, justifyContent: "flex-end" }}>
                <button
                  className="btnSmall danger"
                  onClick={() => onDeletePost(selected)}
                  disabled={deleting}
                  type="button"
                  title="Delete post from Firestore"
                  style={{ padding: "4px 12px", minHeight: "28px" }}
                >
                  {deleting ? "Deleting…" : "Delete Post"}
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
            alt="Zoomed Product View"
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
