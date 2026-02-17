import React from "react";

export default function Table({ columns = [], rows = [], emptyText = "No data." }) {
  return (
    <div className="card tableCard">
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="emptyCell">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id || i}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
