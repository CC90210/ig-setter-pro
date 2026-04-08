"use client";

import { useEffect, useState } from "react";
import { DailyStats, fetchTodayStats, subscribeToStats } from "@/lib/supabase";

interface DailySummaryProps {
  accountId: string | null;
}

export default function DailySummary({ accountId }: DailySummaryProps) {
  const [stats, setStats] = useState<DailyStats | null>(null);

  useEffect(() => {
    if (!accountId) return;
    fetchTodayStats(accountId).then(setStats).catch(() => {});
    const sub = subscribeToStats(() => {
      fetchTodayStats(accountId).then(setStats).catch(() => {});
    });
    return () => { sub.unsubscribe(); };
  }, [accountId]);

  const total = stats?.total_handled || 0;
  const pipeline = total > 0
    ? Math.round(((stats?.booked || 0) + (stats?.closed || 0)) / total * 100)
    : 0;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="daily-summary">
      <div className="daily-summary-header">
        <span>Daily Summary</span>
        <span className="daily-summary-date">{today}</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Handled</div>
          <div className="stat-card-value stat-card-value--mint">{stats?.total_handled ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Qualified</div>
          <div className="stat-card-value stat-card-value--amber">{stats?.qualified ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Booked</div>
          <div className="stat-card-value stat-card-value--blue">{stats?.booked ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Closed</div>
          <div className="stat-card-value stat-card-value--emerald">{stats?.closed ?? 0}</div>
        </div>
      </div>

      <div className="revenue-display">
        <div className="revenue-label">DM Revenue</div>
        <div className="revenue-value">${(stats?.revenue ?? 0).toLocaleString()}</div>
      </div>

      <div className="pipeline-health">
        Pipeline conversion: {pipeline}%
      </div>

      <div className="extra-stats">
        <span>AI drafts: {stats?.ai_drafts ?? 0}</span>
        <span>Auto-sent: {stats?.auto_sent ?? 0}</span>
        <span>Replies: {stats?.replies_received ?? 0}</span>
      </div>
    </div>
  );
}
