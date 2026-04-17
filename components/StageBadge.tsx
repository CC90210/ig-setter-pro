"use client";

import type { Stage, ObjectionType } from "@/lib/db";

interface StageBadgeProps {
  stage: Stage;
  compact?: boolean;
}

const STAGE_META: Record<Stage, { label: string; color: string; bg: string }> = {
  cold:        { label: "Cold",       color: "#7f8ea3", bg: "rgba(127,142,163,0.15)" },
  opener:      { label: "Opener",     color: "#7ac0ff", bg: "rgba(122,192,255,0.15)" },
  qualify:     { label: "Qualify",    color: "#4fc3f7", bg: "rgba(79,195,247,0.15)" },
  pain:        { label: "Pain",       color: "#ffb84d", bg: "rgba(255,184,77,0.15)" },
  solution:    { label: "Solution",   color: "#c7a6ff", bg: "rgba(199,166,255,0.15)" },
  objection:   { label: "Objection",  color: "#ff8a65", bg: "rgba(255,138,101,0.18)" },
  booked:      { label: "Booked",     color: "#00ffab", bg: "rgba(0,255,171,0.15)" },
  closed_won:  { label: "Won",        color: "#00e676", bg: "rgba(0,230,118,0.18)" },
  closed_lost: { label: "Lost",       color: "#ff5252", bg: "rgba(255,82,82,0.15)" },
  dead:        { label: "Dead",       color: "#555",    bg: "rgba(85,85,85,0.2)"    },
};

export default function StageBadge({ stage, compact }: StageBadgeProps) {
  const meta = STAGE_META[stage] || STAGE_META.cold;
  return (
    <span
      className="stage-badge"
      style={{
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.color}33`,
        padding: compact ? "1px 6px" : "2px 8px",
        borderRadius: 4,
        fontSize: compact ? 9 : 10,
        letterSpacing: 0.5,
        fontWeight: 600,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

const OBJECTION_LABELS: Record<ObjectionType, string> = {
  price: "Price",
  timing: "Timing",
  trust: "Trust",
  spouse: "Partner",
  not_now: "Not now",
  competitor: "Competitor",
  happy_current: "Happy w/ current",
  no_budget: "No budget",
  need_info: "Needs info",
  too_busy: "Too busy",
  tried_before: "Tried before",
  bot_check: "Bot check",
  other: "Other",
};

export function ObjectionBadge({ objection }: { objection: ObjectionType | null }) {
  if (!objection) return null;
  return (
    <span
      className="objection-badge"
      style={{
        color: "#ff8a65",
        background: "rgba(255,138,101,0.12)",
        border: "1px solid rgba(255,138,101,0.3)",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 9,
        letterSpacing: 0.5,
        fontWeight: 600,
        textTransform: "uppercase",
      }}
    >
      {OBJECTION_LABELS[objection] || objection}
    </span>
  );
}

export function FriendBadge() {
  return (
    <span
      style={{
        color: "#ffd54f",
        background: "rgba(255,213,79,0.12)",
        border: "1px solid rgba(255,213,79,0.3)",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 9,
        letterSpacing: 0.5,
        fontWeight: 600,
        textTransform: "uppercase",
      }}
      title="Friend mode — casual, no selling"
    >
      Friend
    </span>
  );
}

export function SignalDot({ score }: { score: number }) {
  let color = "#555";
  if (score >= 80) color = "#00ffab";
  else if (score >= 50) color = "#ffb84d";
  else if (score >= 20) color = "#7f8ea3";
  return (
    <span
      title={`Signal score: ${score}/100`}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}88`,
      }}
    />
  );
}
