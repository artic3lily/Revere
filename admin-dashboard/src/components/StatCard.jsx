import React from "react";

export default function StatCard({ label, value, hint, icon }) {
  return (
    <div className="card statCard">
      <div className="statTop">
        <div className="statIcon">{icon}</div>
        <div className="statLabel">{label}</div>
      </div>
      <div className="statValue">{value}</div>
      <div className="statHint">{hint}</div>
    </div>
  );
}
