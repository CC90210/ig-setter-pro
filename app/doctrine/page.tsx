"use client";

import { useCallback, useEffect, useState } from "react";
import type { Account } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import IcpConfigCard from "@/components/IcpConfigCard";

interface StatsResponse {
  window_days: number;
  stage_distribution: Array<{ stage: string; count: number }>;
  transitions: Array<{ from_stage: string; to_stage: string; triggered_by: string; count: number }>;
  objections: Array<{ objection_type: string; count: number }>;
  signal_distribution: Array<{ band: string; count: number }>;
  prospect_queue: Array<{ status: string; count: number }>;
  funnel: Array<{ to_stage: string; threads: number }>;
}

const STAGE_ORDER = ["cold", "opener", "qualify", "pain", "solution", "objection", "booked", "closed_won", "closed_lost", "dead"];
const STAGE_COLORS: Record<string, string> = {
  cold: "#7f8ea3", opener: "#7ac0ff", qualify: "#4fc3f7", pain: "#ffb84d",
  solution: "#c7a6ff", objection: "#ff8a65", booked: "#00ffab",
  closed_won: "#00e676", closed_lost: "#ff5252", dead: "#555",
};

export default function DoctrinePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    const list: Account[] = data.accounts ?? [];
    setAccounts(list);
    if (list.length > 0 && !activeAccountId) setActiveAccountId(list[0].id);
  }, [activeAccountId]);

  const loadStats = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/doctrine/stats?account_id=${activeAccountId}&days=${days}`);
      const data = await res.json();
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, days]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || null;

  const totalThreads = (stats?.stage_distribution || []).reduce((sum, s) => sum + s.count, 0);
  const orderedStages = STAGE_ORDER.map((s) => {
    const row = stats?.stage_distribution.find((r) => r.stage === s);
    return { stage: s, count: row?.count ?? 0 };
  });

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
            <h2 style={{ margin: 0, fontSize: 24 }}>Doctrine Analytics</h2>
            <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>
              Pipeline state, objection patterns, and conversion funnel.
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  background: days === d ? "#00ffab" : "transparent",
                  color: days === d ? "#000" : "#888",
                  border: `1px solid ${days === d ? "#00ffab" : "rgba(255,255,255,0.1)"}`,
                  padding: "6px 12px", borderRadius: 4, cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Loading analytics...</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 20 }}>
              <KPICard label="Total threads" value={totalThreads} />
              <KPICard label="Active pipeline" value={(stats?.stage_distribution || []).filter((s) => !["dead","closed_won","closed_lost"].includes(s.stage)).reduce((s, x) => s + x.count, 0)} />
              <KPICard label={`Booked (last ${days}d)`} value={(stats?.funnel || []).find((f) => f.to_stage === "booked")?.threads ?? 0} color="#00ffab" />
              <KPICard label={`Won (last ${days}d)`} value={(stats?.funnel || []).find((f) => f.to_stage === "closed_won")?.threads ?? 0} color="#00e676" />
            </div>

            {/* Stage distribution funnel */}
            <div style={sectionStyle}>
              <h3 style={sectionHeader}>Pipeline stages — current distribution</h3>
              {orderedStages.map((s) => {
                const pct = totalThreads > 0 ? (s.count / totalThreads) * 100 : 0;
                return (
                  <div key={s.stage} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3, color: "#ccc" }}>
                      <span style={{ textTransform: "uppercase", letterSpacing: 0.5, color: STAGE_COLORS[s.stage] || "#ccc" }}>{s.stage}</span>
                      <span>{s.count} <span style={{ color: "#666" }}>({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 2, height: 6 }}>
                      <div style={{ width: `${pct}%`, background: STAGE_COLORS[s.stage] || "#999", height: 6, borderRadius: 2, transition: "width .3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Objections */}
            <div style={sectionStyle}>
              <h3 style={sectionHeader}>Objections encountered (last {days}d)</h3>
              {(stats?.objections || []).length === 0 ? (
                <p style={{ color: "#666", fontSize: 13 }}>No objections logged in this window.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                  {(stats?.objections || []).map((o) => (
                    <div key={o.objection_type} style={{ background: "rgba(255,138,101,0.08)", border: "1px solid rgba(255,138,101,0.25)", borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 11, color: "#ff8a65", textTransform: "uppercase", letterSpacing: 0.5 }}>{o.objection_type.replace("_", " ")}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{o.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Signal distribution */}
            <div style={sectionStyle}>
              <h3 style={sectionHeader}>Buy-signal distribution</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {["hot", "warm", "cool", "cold"].map((band) => {
                  const count = stats?.signal_distribution.find((s) => s.band === band)?.count ?? 0;
                  const colors: Record<string, string> = { hot: "#00ffab", warm: "#ffb84d", cool: "#7f8ea3", cold: "#555" };
                  return (
                    <div key={band} style={{ background: `${colors[band]}15`, border: `1px solid ${colors[band]}40`, borderRadius: 6, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: colors[band], textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>{band}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ICP config */}
            <IcpConfigCard accountId={activeAccountId} />

            {/* Prospect queue */}
            <div style={sectionStyle}>
              <h3 style={sectionHeader}>Prospect queue</h3>
              {(stats?.prospect_queue || []).length === 0 ? (
                <p style={{ color: "#666", fontSize: 13 }}>Queue is empty. <a href="/prospects" style={{ color: "#00ffab" }}>Add prospects →</a></p>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {(stats?.prospect_queue || []).map((q) => (
                    <div key={q.status} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: 10, minWidth: 100 }}>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{q.status}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{q.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
};

const sectionHeader: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "#888",
  fontWeight: 600,
};

function KPICard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4, color: color || "#fff" }}>{value}</div>
    </div>
  );
}
