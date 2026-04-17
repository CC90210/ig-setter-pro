"use client";

import { useCallback, useEffect, useState } from "react";
import type { IcpConfig } from "@/lib/db";

interface IcpConfigCardProps {
  accountId: string | null;
}

interface FormState {
  allowed_regions: string;
  blocked_regions: string;
  target_niches: string;
  excluded_niches: string;
  min_followers: number;
  max_followers: string;   // empty string = no cap
  auto_archive_oop: boolean;
  stale_days: number;
}

const BLANK: FormState = {
  allowed_regions: "",
  blocked_regions: "",
  target_niches: "",
  excluded_niches: "",
  min_followers: 0,
  max_followers: "",
  auto_archive_oop: true,
  stale_days: 14,
};

export default function IcpConfigCard({ accountId }: IcpConfigCardProps) {
  const [state, setState] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoaded(false);
    try {
      const res = await fetch(`/api/icp?account_id=${accountId}`);
      const data = await res.json();
      const c: IcpConfig | null = data.config ?? null;
      if (c) {
        const parse = (s: string): string => {
          try { return JSON.parse(s || "[]").join(", "); } catch { return ""; }
        };
        setState({
          allowed_regions: parse(c.allowed_regions),
          blocked_regions: parse(c.blocked_regions),
          target_niches: parse(c.target_niches),
          excluded_niches: parse(c.excluded_niches),
          min_followers: c.min_followers ?? 0,
          max_followers: c.max_followers == null ? "" : String(c.max_followers),
          auto_archive_oop: !!c.auto_archive_oop,
          stale_days: c.stale_days ?? 14,
        });
      } else {
        setState(BLANK);
      }
    } finally {
      setLoaded(true);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!accountId) return;
    setSaving(true);
    setMsg(null);
    const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/icp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          allowed_regions: splitList(state.allowed_regions),
          blocked_regions: splitList(state.blocked_regions),
          target_niches: splitList(state.target_niches),
          excluded_niches: splitList(state.excluded_niches),
          min_followers: Number(state.min_followers) || 0,
          max_followers: state.max_followers === "" ? null : Number(state.max_followers),
          auto_archive_oop: state.auto_archive_oop,
          stale_days: Number(state.stale_days) || 14,
        }),
      });
      if (res.ok) {
        setMsg("Saved");
        setTimeout(() => setMsg(null), 2000);
      } else {
        const err = await res.json();
        setMsg(err.error || "Save failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!accountId) {
    return (
      <div style={sectionStyle}>
        <h3 style={sectionHeader}>ICP Filter</h3>
        <p style={{ color: "#666", fontSize: 13 }}>Select an account to configure.</p>
      </div>
    );
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={sectionHeader}>ICP Filter &amp; Lead Hygiene</h3>
        {!loaded && <span style={{ fontSize: 11, color: "#666" }}>loading...</span>}
      </div>

      <p style={{ color: "#888", fontSize: 12, marginTop: 0, marginBottom: 16 }}>
        Classifier uses these to flag out-of-ICP prospects. Stale threshold controls auto-dead cutoff.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <LabeledInput
          label="Allowed regions (comma-sep)"
          hint="e.g. ON-CA, BC-CA, US-*"
          value={state.allowed_regions}
          onChange={(v) => setState({ ...state, allowed_regions: v })}
        />
        <LabeledInput
          label="Blocked regions"
          hint="e.g. IN, PH (fraud-heavy)"
          value={state.blocked_regions}
          onChange={(v) => setState({ ...state, blocked_regions: v })}
        />
        <LabeledInput
          label="Target niches"
          hint="hvac, wellness, real_estate"
          value={state.target_niches}
          onChange={(v) => setState({ ...state, target_niches: v })}
        />
        <LabeledInput
          label="Excluded niches"
          hint="mlm, crypto_signals"
          value={state.excluded_niches}
          onChange={(v) => setState({ ...state, excluded_niches: v })}
        />
        <LabeledInput
          label="Min followers"
          type="number"
          value={String(state.min_followers)}
          onChange={(v) => setState({ ...state, min_followers: Number(v) || 0 })}
        />
        <LabeledInput
          label="Max followers (blank = no cap)"
          type="number"
          value={state.max_followers}
          onChange={(v) => setState({ ...state, max_followers: v })}
        />
        <LabeledInput
          label="Stale-lead cutoff (days)"
          hint="auto-mark dead after N days no reply"
          type="number"
          value={String(state.stale_days)}
          onChange={(v) => setState({ ...state, stale_days: Number(v) || 14 })}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 22 }}>
          <input
            type="checkbox"
            checked={state.auto_archive_oop}
            onChange={(e) => setState({ ...state, auto_archive_oop: e.target.checked })}
            style={{ accentColor: "#00ffab" }}
          />
          Auto-archive out-of-ICP threads
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: "#00ffab", color: "#000",
            border: "none", padding: "8px 16px",
            borderRadius: 4, fontWeight: 600, cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save ICP config"}
        </button>
        {msg && <span style={{ fontSize: 12, color: msg === "Saved" ? "#00ffab" : "#ff8a65" }}>{msg}</span>}
      </div>
    </div>
  );
}

function LabeledInput({ label, hint, value, onChange, type = "text" }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
          padding: "6px 10px",
          borderRadius: 4,
          fontSize: 13,
        }}
      />
      {hint && <div style={{ fontSize: 10, color: "#666", marginTop: 3 }}>{hint}</div>}
    </label>
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
  margin: 0,
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "#888",
  fontWeight: 600,
};
