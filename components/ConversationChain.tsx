"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DMThread, DMMessage } from "@/lib/db";
import { startPolling } from "@/lib/types";

interface ConversationChainProps {
  thread: DMThread;
}

const DASHBOARD_SECRET =
  process.env.NEXT_PUBLIC_DASHBOARD_SECRET || "dashboard-secret";

export default function ConversationChain({ thread }: ConversationChainProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?thread_id=${thread.id}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {}
  }, [thread.id]);

  useEffect(() => {
    loadMessages();
    const stop = startPolling(() => loadMessages(), 3000);
    return stop;
  }, [thread.id, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function patchThread(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/threads/${thread.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify(body),
      });
    } finally {
      setBusy(false);
    }
  }

  async function archiveThread() {
    if (!confirm("Archive this thread? Maven will not reply to new messages from this contact until you re-open it.")) return;
    await patchThread({ status: "closed" });
  }

  async function reopenThread() {
    await patchThread({ status: "active" });
  }

  async function deleteThread() {
    if (!confirm("Delete this thread permanently? Message history will be lost.")) return;
    setBusy(true);
    try {
      await fetch(`/api/threads/${thread.id}`, {
        method: "DELETE",
        headers: { "x-api-secret": DASHBOARD_SECRET },
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  const statusLabel: Record<string, string> = {
    active: "Active — AI is handling this",
    qualified: "Qualified — awaiting next step",
    booked: "Call Booked",
    closed: "Archived — Maven will not reply",
  };

  const isFriend = Boolean(thread.is_friend);
  const isArchived = thread.status === "closed";

  return (
    <div className="conversation-chain">
      <div className="chain-header">
        <div className="chain-header-left">
          <div
            className="chain-avatar"
            style={{
              backgroundColor: thread.avatar_color + "22",
              borderColor: thread.avatar_color + "44",
            }}
          >
            <span style={{ color: thread.avatar_color }}>
              {thread.avatar_initial}
            </span>
          </div>
          <div className="chain-header-info">
            <span className="chain-username">@{thread.username}</span>
            <span className={`chain-status-label chain-status--${thread.status}`}>
              {statusLabel[thread.status] || "Active"}
            </span>
          </div>
        </div>
        <div className="chain-header-right">
          {thread.status === "active" && !isFriend && (
            <div className="ai-running-badge">
              <span className="ai-running-dot" />
              AI Running
            </div>
          )}
          {isFriend && (
            <div className="ai-running-badge" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)", color: "#f59e0b" }}>
              FRIEND MODE
            </div>
          )}
          {isArchived && <div className="closed-badge">Archived</div>}
          {thread.status === "booked" && <div className="booked-badge">Call Booked</div>}

          <button
            className="thread-action-btn"
            disabled={busy}
            onClick={() => patchThread({ is_friend: !isFriend })}
            title={isFriend ? "Switch back to NEPQ doctrine" : "Drop selling, talk like a friend"}
          >
            {isFriend ? "Unfriend" : "Friend"}
          </button>
          {isArchived ? (
            <button className="thread-action-btn" disabled={busy} onClick={reopenThread} title="Resume Maven on this thread">
              Re-open
            </button>
          ) : (
            <button className="thread-action-btn" disabled={busy} onClick={archiveThread} title="Stop Maven from replying to this thread">
              Archive
            </button>
          )}
          <button
            className="thread-action-btn thread-action-btn--danger"
            disabled={busy}
            onClick={deleteThread}
            title="Permanently delete thread + message history"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="messages-list">
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`message-row message-row--${msg.direction}`}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {msg.direction === "outbound" && msg.is_ai && (
              <div className="ai-badge-inline">AI</div>
            )}
            {msg.direction === "outbound" && msg.override && (
              <div
                className="ai-badge-inline"
                style={{ color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.08)" }}
              >
                OVERRIDE
              </div>
            )}
            <div className={`message-bubble ${msg.direction === "inbound" ? "bubble--inbound" : "bubble--outbound"}`}>
              {msg.content}
            </div>
            <span className="message-time">
              {new Date(msg.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}

        {thread.status === "active" && thread.pending_ai_draft && (
          <div className="message-row message-row--outbound composing-row">
            <div className="ai-badge-inline ai-badge--composing">AI</div>
            <div className="bubble--composing">
              <span className="composing-typing">
                <span className="typing-dot" style={{ animationDelay: "0ms" }} />
                <span className="typing-dot" style={{ animationDelay: "200ms" }} />
                <span className="typing-dot" style={{ animationDelay: "400ms" }} />
              </span>
              <span className="composing-preview">{thread.pending_ai_draft}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
