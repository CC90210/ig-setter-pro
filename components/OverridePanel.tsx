"use client";

import { useState } from "react";
import type { DMThread, Stage } from "@/lib/db";
import StageBadge, { ObjectionBadge, SignalDot } from "./StageBadge";

interface OverridePanelProps {
  thread: DMThread;
}

const STAGE_OPTIONS: Stage[] = [
  "cold", "opener", "qualify", "pain", "solution", "objection",
  "booked", "closed_won", "closed_lost", "dead",
];

export default function OverridePanel({ thread }: OverridePanelProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isFriend, setIsFriend] = useState<boolean>(!!thread.is_friend);
  const [stage, setStage] = useState<Stage>(thread.stage || "cold");
  const [updatingDoctrine, setUpdatingDoctrine] = useState(false);

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: thread.id, message: message.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        setFeedback({ type: "error", text: err.error || "Failed to send" });
      } else {
        setMessage("");
        setFeedback({ type: "success", text: "Sent" });
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch {
      setFeedback({ type: "error", text: "Network error" });
    } finally {
      setSending(false);
    }
  }

  async function handleApproveDraft() {
    if (!thread.pending_ai_draft || sending) return;
    setSending(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: thread.id, message: thread.pending_ai_draft }),
      });

      if (!res.ok) {
        const err = await res.json();
        setFeedback({ type: "error", text: err.error || "Failed to send" });
      } else {
        setFeedback({ type: "success", text: "AI draft sent" });
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch {
      setFeedback({ type: "error", text: "Network error" });
    } finally {
      setSending(false);
    }
  }

  async function handleToggleFriend() {
    const next = !isFriend;
    setUpdatingDoctrine(true);
    try {
      const res = await fetch(`/api/threads/${thread.id}/doctrine`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_friend: next }),
      });
      if (res.ok) {
        setIsFriend(next);
        setFeedback({ type: "success", text: next ? "Friend mode ON" : "Friend mode OFF" });
        setTimeout(() => setFeedback(null), 2000);
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to update" });
    } finally {
      setUpdatingDoctrine(false);
    }
  }

  async function handleChangeStage(next: Stage) {
    if (next === stage) return;
    setUpdatingDoctrine(true);
    try {
      const res = await fetch(`/api/threads/${thread.id}/doctrine`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      if (res.ok) {
        setStage(next);
        setFeedback({ type: "success", text: `Moved to ${next}` });
        setTimeout(() => setFeedback(null), 2000);
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to update" });
    } finally {
      setUpdatingDoctrine(false);
    }
  }

  async function handleCompleteCall(outcome: "won" | "lost") {
    if (!confirm(outcome === "won"
      ? "Mark call completed and deliver the full PULSE repo to the prospect?"
      : "Mark call completed as CLOSED LOST (no repo will be sent)?"
    )) return;
    setUpdatingDoctrine(true);
    try {
      const res = await fetch("/api/calls/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The webhook secret is needed server-side; the browser has no access to it.
          // For production, this button should route through a server action or
          // authenticated admin route. For now, we rely on same-origin + the fact
          // that the endpoint is discoverable only to CC who is already on the dashboard.
        },
        body: JSON.stringify({ thread_id: thread.id, outcome }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStage(outcome === "won" ? "closed_won" : "closed_lost");
        setFeedback({
          type: "success",
          text: outcome === "won"
            ? (data.email?.sent ? "Call marked won. Repo email sent." : "Call marked won (email queue err — check logs)")
            : "Call marked lost.",
        });
        setTimeout(() => setFeedback(null), 3500);
      } else {
        setFeedback({ type: "error", text: data.error || "Failed to complete call" });
      }
    } catch {
      setFeedback({ type: "error", text: "Network error" });
    } finally {
      setUpdatingDoctrine(false);
    }
  }

  return (
    <div className="override-panel">
      <div className="override-header">
        <span>Manual Override</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SignalDot score={thread.signal_score || 0} />
          <StageBadge stage={stage} compact />
        </div>
      </div>

      <div
        style={{
          padding: "10px 12px",
          marginBottom: 12,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#888", letterSpacing: 0.5, textTransform: "uppercase" }}>
            Doctrine
          </span>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              cursor: "pointer",
              color: isFriend ? "#ffd54f" : "#888",
            }}
          >
            <input
              type="checkbox"
              checked={isFriend}
              onChange={handleToggleFriend}
              disabled={updatingDoctrine}
              style={{ accentColor: "#ffd54f" }}
            />
            Friend mode
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#888" }}>Stage:</span>
          <select
            value={stage}
            onChange={(e) => handleChangeStage(e.target.value as Stage)}
            disabled={updatingDoctrine}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              borderRadius: 4,
              padding: "3px 6px",
              fontSize: 12,
              flex: 1,
            }}
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {thread.objection && (
          <div style={{ marginTop: 8 }}>
            <ObjectionBadge objection={thread.objection} />
          </div>
        )}
        {thread.bot_check_count > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#ff8a65" }}>
            Bot-check asked {thread.bot_check_count}x
          </div>
        )}
      </div>

      {stage === "booked" && (
        <div
          style={{
            padding: "12px 14px",
            marginBottom: 12,
            background: "rgba(0,255,171,0.08)",
            border: "1px solid rgba(0,255,171,0.3)",
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: 11, color: "#00ffab", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Call booked {thread.booked_for ? `\u2014 ${new Date(thread.booked_for).toLocaleString()}` : ""}
          </div>
          {thread.booking_email && (
            <div style={{ fontSize: 12, color: "#ccc", marginBottom: 10 }}>
              Prospect email: <code style={{ color: "#00ffab" }}>{thread.booking_email}</code>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleCompleteCall("won")}
              disabled={updatingDoctrine}
              style={{
                flex: 1,
                background: "#00ffab",
                color: "#000",
                border: "none",
                padding: "8px 12px",
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 12,
                cursor: updatingDoctrine ? "wait" : "pointer",
              }}
            >
              {updatingDoctrine ? "..." : "Call done \u2014 send repo"}
            </button>
            <button
              onClick={() => handleCompleteCall("lost")}
              disabled={updatingDoctrine}
              style={{
                flex: 1,
                background: "transparent",
                color: "#ff8a65",
                border: "1px solid rgba(255,138,101,0.4)",
                padding: "8px 12px",
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 12,
                cursor: updatingDoctrine ? "wait" : "pointer",
              }}
            >
              Call lost
            </button>
          </div>
          {thread.repo_delivered_at && (
            <div style={{ fontSize: 10, color: "#00ffab", marginTop: 8, opacity: 0.7 }}>
              Repo already delivered: {new Date(thread.repo_delivered_at).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {thread.pending_ai_draft && !["dead", "closed_lost", "closed_won"].includes(stage) && (
        <div>
          <div className="ai-draft-label">AI DRAFT ({stage})</div>
          <div className="ai-draft-preview">{thread.pending_ai_draft}</div>
          <button
            className="btn-override btn-override--approve"
            onClick={handleApproveDraft}
            disabled={sending}
            style={{ width: "100%", marginBottom: 12 }}
          >
            {sending ? "Sending..." : "Approve & Send AI Draft"}
          </button>
        </div>
      )}

      <textarea
        className="override-textarea"
        rows={3}
        placeholder="Type a manual reply..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={sending}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
      />

      <div className="override-actions">
        <button
          className="btn-override btn-override--send"
          onClick={handleSend}
          disabled={sending || !message.trim()}
        >
          {sending ? "Sending..." : "Send Override"}
        </button>
      </div>

      {feedback && (
        <div className={`override-feedback override-feedback--${feedback.type}`}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}
