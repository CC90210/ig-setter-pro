"use client";

import type { DMThread } from "@/lib/db";
import { formatRelativeTime } from "@/lib/types";
import StageBadge, { ObjectionBadge, FriendBadge, SignalDot } from "./StageBadge";

interface ThreadFeedProps {
  threads: DMThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

export default function ThreadFeed({ threads, selectedId, onSelect, loading }: ThreadFeedProps) {
  if (loading) {
    return (
      <div>
        <div className="thread-feed-header">
          <span className="thread-feed-title">
            <span className="live-dot" />
            Conversations
          </span>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="loading-skeleton">
            <div className="skeleton-line skeleton-line--short" />
            <div className="skeleton-line skeleton-line--long" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="thread-feed-header">
        <span className="thread-feed-title">
          <span className="live-dot" />
          Conversations
        </span>
        <span className="thread-count">{threads.length}</span>
      </div>

      {threads.length === 0 && (
        <div className="empty-state" style={{ height: 200 }}>
          <p>No conversations yet</p>
        </div>
      )}

      {threads.map((thread) => (
        <div
          key={thread.id}
          className={`thread-card ${thread.id === selectedId ? "thread-card--selected" : ""}`}
          onClick={() => onSelect(thread.id)}
        >
          <div
            className="thread-avatar"
            style={{
              backgroundColor: thread.avatar_color + "22",
              borderColor: thread.avatar_color + "44",
              color: thread.avatar_color,
            }}
          >
            {thread.avatar_initial}
          </div>
          <div className="thread-info">
            <div className="thread-top">
              <span className="thread-username">
                <SignalDot score={thread.signal_score || 0} />
                <span style={{ marginLeft: 6 }}>@{thread.username}</span>
              </span>
              <span className="thread-time">
                {thread.last_timestamp ? formatRelativeTime(thread.last_timestamp) : ""}
              </span>
            </div>
            <div className="thread-preview">{thread.last_message}</div>
            <div className="thread-bottom" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <StageBadge stage={thread.stage || "cold"} compact />
              {thread.objection && <ObjectionBadge objection={thread.objection} />}
              {thread.is_friend ? <FriendBadge /> : null}
              {thread.pending_ai_draft && thread.stage !== "dead" && thread.stage !== "closed_lost" && (
                <span className="ai-typing-badge">
                  <span className="live-dot" />
                  AI drafting
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
