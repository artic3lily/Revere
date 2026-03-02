import React from "react";
import { useTheme } from "../context/ThemeContext";

export default function Settings() {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="page">
            <div className="pageHeader">
                <div>
                    <div className="pageTitle">Settings</div>
                    <div className="pageHint">Manage your admin dashboard preferences.</div>
                </div>
            </div>

            <div className="card" style={{ padding: 20, maxWidth: 600 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: "16px" }}>Dashboard Theme</div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                            Switch between Light and Dark modes.
                        </div>
                    </div>

                    <button
                        className="btnPrimary"
                        onClick={toggleTheme}
                        style={{ minWidth: 120 }}
                    >
                        {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
                    </button>
                </div>
            </div>
        </div>
    );
}
