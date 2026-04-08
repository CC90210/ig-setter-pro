"use client";

import { useEffect, useState } from "react";
import { DailyStats, fetchTodayStats, subscribeToStats } from "@/lib/supabase";

interface StatsBarProps {
  accountId: string | null;
}

export default function StatsBar({ accountId }: StatsBarProps) {
  const [stats, setStats] = useState<DailyStats | null>(null);

  useEffect(() => {
    if (!accountId) return;
    fetchTodayStats(accountId).then(setStats).catch(() => {});
    const sub = subscribeToStats(() => {
      fetchTodayStats(accountId).then(setStats).catch(() => {});
    });
    return () => { sub.unsubscribe(); };
  }, [accountId]);

  return (
    <div className="stats-bar">
      <div className="live-badge">
        <span className="live-dot" />
        LIVE
      </div>
      <div className="stat-item">
        <span>Conversations</span>
        <span className="stat-value">{stats?.total_handled ?? 0}</span>
      </div>
      <div className="stat-item">
        <span>Closed</span>
        <span className="stat-value">{stats?.closed ?? 0}</span>
      </div>
      <div className="stat-item">
        <span>Revenue</span>
        <span className="stat-value stat-value--mint">
          ${(stats?.revenue ?? 0).toLocaleString()}
        </span>
      </div>
      <div className="stat-item">
        <span>AI Drafts</span>
        <span className="stat-value">{stats?.ai_drafts ?? 0}</span>
      </div>
      <div className="stat-item">
        <span>Auto-Sent</span>
        <span className="stat-value">{stats?.auto_sent ?? 0}</span>
      </div>
    </div>
  );
}
