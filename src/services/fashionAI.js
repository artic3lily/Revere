import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase"; 

const fashionChat = httpsCallable(functions, "fashionChat");

export async function askFashionAI(messages) {
  const res = await fashionChat({ messages });
  return res.data; // { role, content }
}
