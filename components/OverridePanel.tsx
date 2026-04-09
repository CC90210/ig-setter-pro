"use client";

import { useState } from "react";
import type { DMThread } from "@/lib/db";

interface OverridePanelProps {
  thread: DMThread;
}

export default function OverridePanel({ thread }: OverridePanelProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const statusIcon: Record<string, string> = {
    closed: "Done",
    booked: "Booked",
    qualified: "Qualifying...",
    active: "Monitoring",
  };

  return (
    <div className="override-panel">
      <div className="override-header">
        <span>Manual Override</span>
        <span className="override-status">{statusIcon[thread.status] || "Active"}</span>
      </div>

      {thread.pending_ai_draft && thread.status === "active" && (
        <div>
          <div className="ai-draft-label">AI DRAFT</div>
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
