import React from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function NotAdmin() {
  const nav = useNavigate();

  const logout = async () => {
    await signOut(auth);
    nav("/login", { replace: true });
  };

  return (
    <div className="pageCenter">
      <div className="loaderCard">
        <h2 style={{ margin: 0 }}>Access denied</h2>
        <p className="muted">This account is not an admin.</p>
        <button className="btnPrimary" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}
