import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { auth } from "../config/firebase";

/*Saves chat message (user or assistant)*/
export async function saveChatMessage(role, content) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not logged in");

  const ref = collection(db, "users", uid, "chatMessages");

  await addDoc(ref, {
    role,
    content,
    createdAt: serverTimestamp(),
  });
}

/*Load last ndd chat messages*/
export async function loadChatMessages(max = 50) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not logged in");

  const ref = collection(db, "users", uid, "chatMessages");

  const q = query(ref, orderBy("createdAt", "asc"), limit(max));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}
