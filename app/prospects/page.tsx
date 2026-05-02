"use client";

import { useCallback, useEffect, useState } from "react";
import type { Prospect, Account } from "@/lib/db";
import Sidebar from "@/components/Sidebar";

export default function ProspectsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("queued");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [inserting, setInserting] = useState(false);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    const list: Account[] = data.accounts ?? [];
    setAccounts(list);
    if (list.length > 0 && !activeAccountId) setActiveAccountId(list[0].id);
  }, [activeAccountId]);

  const loadProspects = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ account_id: activeAccountId });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/prospects?${params}`);
      const data = await res.json();
      setProspects(data.prospects ?? []);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, statusFilter]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadProspects(); }, [loadProspects]);

  async function handleBulkAdd() {
    if (!activeAccountId || !bulkInput.trim()) return;
    setInserting(true);
    try {
      const lines = bulkInput.split("\n").map((l) => l.trim()).filter(Boolean);
      const prospects = lines.map((line) => {
        // Accept: "@username", "username", "username | reason", "username | reason | niche"
        const parts = line.replace(/^@/, "").split("|").map((p) => p.trim());
        return {
          ig_username: parts[0],
          reason: parts[1] || undefined,
          niche: parts[2] || undefined,
          source: "bulk_add",
        };
      });
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: activeAccountId, prospects }),
      });
      const data = await res.json();
      if (data.ok) {
        setBulkInput("");
        setShowAdd(false);
        loadProspects();
        alert(`Added ${data.inserted}, skipped ${data.skipped}`);
      }
    } finally {
      setInserting(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadProspects();
  }

  async function deleteProspect(id: string) {
    if (!confirm("Delete this prospect?")) return;
    await fetch(`/api/prospects/${id}`, { method: "DELETE" });
    loadProspects();
  }

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || null;

  return (
    <div className="app-shell">
      <Sidebar
        accounts={accounts}
        activeAccountId={activeAccountId}
        onAccountChange={setActiveAccountId}
        activeAccount={activeAccount}
      />

      <main className="page-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24 }}>Prospect Queue</h2>
            <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>
              Proactive outreach. Cold openers go out on the cron schedule (13:00, 17:00, 21:00 UTC).
            </p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            style={{
              background: "#00ffab",
              color: "#000",
              border: "none",
              padding: "10px 16px",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {showAdd ? "Cancel" : "+ Bulk add"}
          </button>
        </div>

        {showAdd && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: 16, borderRadius: 8, marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>
              One per line. Format: <code>username | reason | niche</code> — only username required.
            </label>
            <textarea
              rows={8}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={"@johnsmithhvac | 5k followers, runs HVAC in ON | hvac\n@localgym | owns boutique gym | fitness\n..."}
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: 10,
                borderRadius: 4,
                fontFamily: "monospace",
                fontSize: 13,
              }}
            />
            <button
              onClick={handleBulkAdd}
              disabled={inserting || !bulkInput.trim()}
              style={{
                marginTop: 10,
                background: "#00ffab",
                color: "#000",
                border: "none",
                padding: "8px 14px",
                borderRadius: 4,
                fontWeight: 600,
                cursor: inserting ? "wait" : "pointer",
              }}
            >
              {inserting ? "Adding..." : "Add to queue"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["queued", "sent", "replied", "failed", "all"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                background: statusFilter === s ? "#00ffab" : "transparent",
                color: statusFilter === s ? "#000" : "#888",
                border: `1px solid ${statusFilter === s ? "#00ffab" : "rgba(255,255,255,0.1)"}`,
                padding: "6px 12px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#888" }}>
                <th style={{ textAlign: "left", padding: 12 }}>Username</th>
                <th style={{ textAlign: "left", padding: 12 }}>Niche</th>
                <th style={{ textAlign: "left", padding: 12 }}>Reason</th>
                <th style={{ textAlign: "center", padding: 12 }}>Priority</th>
                <th style={{ textAlign: "center", padding: 12 }}>Status</th>
                <th style={{ textAlign: "center", padding: 12 }}>Attempts</th>
                <th style={{ textAlign: "right", padding: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#888" }}>Loading...</td></tr>
              ) : prospects.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#888" }}>
                  No prospects with status &quot;{statusFilter}&quot;
                </td></tr>
              ) : prospects.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: 12 }}>
                    <a
                      href={p.profile_url || `https://instagram.com/${p.ig_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#00ffab", textDecoration: "none" }}
                    >
                      @{p.ig_username}
                    </a>
                  </td>
                  <td style={{ padding: 12, color: "#ccc", fontSize: 13 }}>{p.niche || "-"}</td>
                  <td style={{ padding: 12, color: "#aaa", fontSize: 13, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.reason || p.personalization || "-"}
                  </td>
                  <td style={{ padding: 12, textAlign: "center", fontFamily: "monospace" }}>{p.priority}</td>
                  <td style={{ padding: 12, textAlign: "center" }}>
                    <StatusPill status={p.status} />
                  </td>
                  <td style={{ padding: 12, textAlign: "center", color: "#888" }}>{p.attempts}</td>
                  <td style={{ padding: 12, textAlign: "right" }}>
                    {p.status === "failed" && (
                      <button onClick={() => updateStatus(p.id, "queued")} style={btnStyle}>Retry</button>
                    )}
                    {p.status === "queued" && (
                      <button onClick={() => updateStatus(p.id, "skipped")} style={btnStyle}>Skip</button>
                    )}
                    <button onClick={() => deleteProspect(p.id)} style={{ ...btnStyle, color: "#ff5252" }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#ccc",
  padding: "4px 10px",
  borderRadius: 4,
  fontSize: 11,
  cursor: "pointer",
  marginLeft: 4,
};

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    queued:   { bg: "rgba(79,195,247,0.15)", fg: "#4fc3f7" },
    sending:  { bg: "rgba(255,184,77,0.15)", fg: "#ffb84d" },
    sent:     { bg: "rgba(0,255,171,0.15)",   fg: "#00ffab" },
    replied:  { bg: "rgba(199,166,255,0.18)", fg: "#c7a6ff" },
    skipped:  { bg: "rgba(127,142,163,0.15)", fg: "#7f8ea3" },
    failed:   { bg: "rgba(255,82,82,0.15)",   fg: "#ff5252" },
    blocked:  { bg: "rgba(85,85,85,0.2)",     fg: "#999"    },
  };
  const c = colors[status] || colors.skipped;
  return (
    <span style={{
      background: c.bg, color: c.fg,
      padding: "2px 8px", borderRadius: 4, fontSize: 10,
      fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      {status}
    </span>
  );
}
