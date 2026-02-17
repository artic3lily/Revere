import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!email.trim() || !pass) return setErr("Enter email and password.");
    try {
      setBusy(true);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      nav("/", { replace: true });
    } catch (e) {
      setErr(e?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="loginWrap">
      <div className="loginCard">
        <div className="loginBrand">
          <div className="brandMark big">R</div>
          <div>
            <div className="brandName">Revere</div>
            <div className="brandSub">Admin Dashboard</div>
          </div>
        </div>

        <div className="loginTitle">Sign in</div>
        <div className="loginHint">Use your admin account</div>

        <input
          className="input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          placeholder="Password"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? submit() : null)}
        />

        {err ? <div className="errorBox">{err}</div> : null}

        <button className="btnPrimary" onClick={submit} disabled={busy}>
          {busy ? "Signing in…" : "Login"}
        </button>

        <div className="muted small" style={{ marginTop: 10 }}>
          You must have <b>role = admin</b> in Firestore users/{`{uid}`}.
        </div>
      </div>
    </div>
  );
}
