"use client";

import { useCallback, useEffect, useState } from "react";
import type { Account } from "@/lib/db";
import DashboardNav from "@/components/DashboardNav";

type Period = "7d" | "30d" | "90d";

interface AnalyticsData {
  period: Period;
  subscribers: {
    total: number;
    new_this_period: number;
    opted_in: number;
  };
  engagement: {
    total_messages: number;
    inbound: number;
    outbound: number;
    ai_drafts: number;
  };
  conversion_funnel: {
    reached: number;
    engaged: number;
    qualified: number;
    booked: number;
    closed: number;
    revenue: number;
  };
  top_triggers: Array<{ id: string; name: string; times_triggered: number; times_sent: number }>;
  top_tags: Array<{ id: string; name: string; subscriber_count: number }>;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function BigStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="big-stat-card">
      <div className="big-stat-label">{label}</div>
      <div
        className="big-stat-value"
        style={accent ? { color: "var(--mint)" } : undefined}
      >
        {value}
      </div>
      {sub && <div className="big-stat-sub">{sub}</div>}
    </div>
  );
}

// ─── Funnel bar ───────────────────────────────────────────────────────────────

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="funnel-row">
      <div className="funnel-label">{label}</div>
      <div className="funnel-bar-wrap">
        <div
          className="funnel-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="funnel-value" style={{ color }}>
        {value.toLocaleString()}
      </div>
      <div className="funnel-pct">{pct}%</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      const d = await res.json();
      const accts: Account[] = d.accounts ?? [];
      setAccounts(accts);
      if (accts.length > 0 && !activeAccountId) {
        setActiveAccountId(accts[0].id);
      }
    } catch {
      // silent
    }
  }, [activeAccountId]);

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?account_id=${activeAccountId}&period=${period}`);
      const d = await res.json();
      setData(d);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, period]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadData(); }, [loadData]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  const funnel = data?.conversion_funnel;
  const funnelMax = funnel?.reached ?? 1;

  const engagementRate =
    funnel && funnel.reached > 0
      ? ((funnel.engaged / funnel.reached) * 100).toFixed(1)
      : "0.0";

  const periodLabel =
    period === "7d" ? "last 7 days" : period === "30d" ? "last 30 days" : "last 90 days";

  return (
    <div className="app">
      <DashboardNav
        accounts={accounts}
        activeAccountId={activeAccountId}
        onAccountChange={(id) => setActiveAccountId(id)}
        activeAccount={activeAccount}
      />

      <main className="page-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">Analytics</h2>
            <p className="page-subtitle">Performance overview · {periodLabel}</p>
          </div>
          <div className="period-selector">
            {(["7d", "30d", "90d"] as Period[]).map((p) => (
              <button
                key={p}
                className={`period-btn${period === p ? " period-btn--active" : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="page-loading">Loading analytics...</div>
        ) : !data ? (
          <div className="page-empty">No analytics data available</div>
        ) : (
          <>
            {/* Big stat cards */}
            <div className="big-stats-row">
              <BigStat
                label="Total Subscribers"
                value={data.subscribers.total.toLocaleString()}
                sub={`${data.subscribers.opted_in} opted in`}
              />
              <BigStat
                label="New This Period"
                value={`+${data.subscribers.new_this_period.toLocaleString()}`}
                sub={periodLabel}
                accent
              />
              <BigStat
                label="Engagement Rate"
                value={`${engagementRate}%`}
                sub="replied / reached"
              />
              <BigStat
                label="Conversions"
                value={data.conversion_funnel.closed.toLocaleString()}
                sub={`${data.conversion_funnel.booked} booked`}
              />
              <BigStat
                label="Revenue"
                value={`${data.conversion_funnel.revenue.toLocaleString()}`}
                sub={periodLabel}
                accent
              />
            </div>

            {/* Conversion funnel */}
            <div className="analytics-section">
              <h3 className="analytics-section-title">Conversion Funnel</h3>
              <div className="funnel-container">
                <FunnelBar
                  label="Reached"
                  value={funnel?.reached ?? 0}
                  max={funnelMax}
                  color="#888"
                />
                <FunnelBar
                  label="Engaged"
                  value={funnel?.engaged ?? 0}
                  max={funnelMax}
                  color="#3b82f6"
                />
                <FunnelBar
                  label="Qualified"
                  value={funnel?.qualified ?? 0}
                  max={funnelMax}
                  color="#f59e0b"
                />
                <FunnelBar
                  label="Booked"
                  value={funnel?.booked ?? 0}
                  max={funnelMax}
                  color="#8b5cf6"
                />
                <FunnelBar
                  label="Closed"
                  value={funnel?.closed ?? 0}
                  max={funnelMax}
                  color="#00FFAB"
                />
              </div>
            </div>

            {/* Tables row */}
            <div className="analytics-tables-row">
              {/* Top triggers */}
              <div className="analytics-table-card">
                <h3 className="analytics-section-title">Top Comment Triggers</h3>
                {data.top_triggers.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>
                    No triggers fired yet
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Trigger</th>
                        <th>Triggered</th>
                        <th>Sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_triggers.map((t) => (
                        <tr key={t.id} className="table-row">
                          <td style={{ fontWeight: 500 }}>{t.name}</td>
                          <td className="table-cell-mono">{t.times_triggered}</td>
                          <td className="table-cell-mono">{t.times_sent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top tags */}
              <div className="analytics-table-card">
                <h3 className="analytics-section-title">Top Tags by Subscribers</h3>
                {data.top_tags.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>
                    No tags created yet
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tag</th>
                        <th>Subscribers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_tags.map((tag) => (
                        <tr key={tag.id} className="table-row">
                          <td style={{ fontWeight: 500 }}>{tag.name}</td>
                          <td className="table-cell-mono">{tag.subscriber_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Engagement breakdown */}
            <div className="analytics-section">
              <h3 className="analytics-section-title">Message Breakdown</h3>
              <div className="big-stats-row" style={{ marginTop: 12 }}>
                <BigStat
                  label="Total Messages"
                  value={data.engagement.total_messages.toLocaleString()}
                />
                <BigStat
                  label="Inbound"
                  value={data.engagement.inbound.toLocaleString()}
                />
                <BigStat
                  label="Outbound"
                  value={data.engagement.outbound.toLocaleString()}
                />
                <BigStat
                  label="AI Drafts"
                  value={data.engagement.ai_drafts.toLocaleString()}
                  accent
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
