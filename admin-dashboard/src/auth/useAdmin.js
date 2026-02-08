// src/auth/useAdmin.js
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export function useAdmin() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (!u) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? snap.data() : null;
        setIsAdmin(data?.role === "admin");
      } catch (e) {
        console.log("Admin check error:", e);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return { user, isAdmin, loading };
}
