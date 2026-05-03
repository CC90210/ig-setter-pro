"use client";

import { useEffect, useState } from "react";

interface Heartbeat {
  status: "online" | "degraded" | "offline";
  age_seconds: number;
  pid: number | null;
  poll_count: number | null;
  browser_channel: string | null;
  version: string | null;
  hostname: string | null;
  last_seen_at: string;
}

function ageLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DaemonStatus() {
  const [hb, setHb] = useState<Heartbeat | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchHb = async () => {
      try {
        const res = await fetch("/api/python/heartbeat");
        const data = await res.json();
        if (!cancelled) {
          setHb(data.heartbeat ?? null);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    };
    fetchHb();
    const t = setInterval(fetchHb, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!loaded) {
    return (
      <div className="daemon-status daemon-status--unknown">
        <span className="daemon-status__dot" />
        <span className="daemon-status__label">…</span>
      </div>
    );
  }

  if (!hb) {
    return (
      <div className="daemon-status daemon-status--offline" title="Daemon has never reported in. Run scripts/start_pulse_daemon.ps1.">
        <span className="daemon-status__dot" />
        <span className="daemon-status__label">DAEMON OFFLINE</span>
      </div>
    );
  }

  const tooltip = [
    `Status: ${hb.status.toUpperCase()}`,
    `Last seen: ${ageLabel(hb.age_seconds)}`,
    hb.poll_count ? `Polls: ${hb.poll_count}` : null,
    hb.browser_channel ? `Browser: ${hb.browser_channel}` : null,
    hb.hostname ? `Host: ${hb.hostname}` : null,
    hb.version ? `Daemon v${hb.version}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className={`daemon-status daemon-status--${hb.status}`} title={tooltip}>
      <span className="daemon-status__dot" />
      <span className="daemon-status__label">
        DAEMON {hb.status.toUpperCase()}
      </span>
      <span className="daemon-status__age">{ageLabel(hb.age_seconds)}</span>
    </div>
  );
}
