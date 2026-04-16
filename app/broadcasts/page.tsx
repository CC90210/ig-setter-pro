"use client";

import { useCallback, useEffect, useState } from "react";
import type { Account, Broadcast, Tag } from "@/lib/db";
import DashboardNav from "@/components/DashboardNav";
import { formatRelativeTime } from "@/lib/types";

const DASHBOARD_SECRET = "DASHBOARD_SECRET";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  Broadcast["status"],
  { label: string; color: string; bg: string; border: string }
> = {
  draft:      { label: "Draft",     color: "#888",     bg: "rgba(136,136,136,0.1)",  border: "rgba(136,136,136,0.2)" },
  scheduled:  { label: "Scheduled", color: "#f59e0b",  bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.2)" },
  sending:    { label: "Sending",   color: "#3b82f6",  bg: "rgba(59,130,246,0.1)",   border: "rgba(59,130,246,0.2)" },
  sent:       { label: "Sent",      color: "#10b981",  bg: "rgba(16,185,129,0.1)",   border: "rgba(16,185,129,0.2)" },
  failed:     { label: "Failed",    color: "#ef4444",  bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.2)" },
};

function StatusBadge({ status }: { status: Broadcast["status"] }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 4,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: style.color,
        background: style.bg,
        border: `1px solid ${style.border}`,
        fontFamily: "var(--font-mono)",
      }}
    >
      {style.label}
    </span>
  );
}

// ─── Create Broadcast Modal ───────────────────────────────────────────────────

interface CreateBroadcastModalProps {
  accountId: string;
  tags: Tag[];
  onCreated: () => void;
  onClose: () => void;
}

function CreateBroadcastModal({
  accountId,
  tags,
  onCreated,
  onClose,
}: CreateBroadcastModalProps) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [targetAll, setTargetAll] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      setError("Name and message are required");
      return;
    }
    if (!targetAll && selectedTagIds.length === 0) {
      setError("Select at least one tag or target all subscribers");
      return;
    }
    if (scheduleMode === "later" && !scheduledAt) {
      setError("Please select a schedule date/time");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({
          account_id: accountId,
          name: name.trim(),
          message: message.trim(),
          button_text: buttonText.trim() || undefined,
          button_url: buttonUrl.trim() || undefined,
          target_all: targetAll,
          target_tag_ids: targetAll ? [] : selectedTagIds,
          scheduled_at: scheduleMode === "later" ? scheduledAt : undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create broadcast");
      } else {
        onCreated();
        onClose();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Create Broadcast</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <label className="form-label">Broadcast Name *</label>
          <input
            className="form-input"
            placeholder="e.g. March Free Guide Drop"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <label className="form-label" style={{ marginTop: 12 }}>Message *</label>
          <textarea
            className="form-textarea"
            placeholder="Hey! I'm not sure if you've seen this yet, but I just dropped something that could help you... what's your biggest challenge with [topic] right now?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
          <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {message.length} chars
          </div>

          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Button Text (optional)</label>
              <input
                className="form-input"
                placeholder="Get the guide →"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Button URL (optional)</label>
              <input
                className="form-input"
                placeholder="https://..."
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="form-label">Target Audience</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  checked={targetAll}
                  onChange={() => setTargetAll(true)}
                />
                <span>All subscribers</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  checked={!targetAll}
                  onChange={() => setTargetAll(false)}
                />
                <span>Subscribers with specific tags</span>
              </label>
            </div>
            {!targetAll && (
              <div className="tag-multi-select">
                {tags.length === 0 ? (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    No tags available — create tags in Subscribers first
                  </span>
                ) : (
                  tags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={`drawer-tag-btn${selected ? " drawer-tag-btn--active" : ""}`}
                        style={
                          selected
                            ? {
                                background: tag.color + "22",
                                color: tag.color,
                                border: `1px solid ${tag.color}66`,
                              }
                            : {}
                        }
                        onClick={() => toggleTag(tag.id)}
                      >
                        {selected ? "✓ " : "+ "}
                        {tag.name}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="form-label">Schedule</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  checked={scheduleMode === "now"}
                  onChange={() => setScheduleMode("now")}
                />
                <span>Save as draft</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  checked={scheduleMode === "later"}
                  onChange={() => setScheduleMode("later")}
                />
                <span>Schedule for later</span>
              </label>
            </div>
            {scheduleMode === "later" && (
              <input
                type="datetime-local"
                className="form-input"
                style={{ marginTop: 8 }}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            )}
          </div>

          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Create Broadcast"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BroadcastsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      const accts: Account[] = data.accounts ?? [];
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
      const [bcRes, tagRes] = await Promise.all([
        fetch(`/api/broadcasts?account_id=${activeAccountId}`),
        fetch(`/api/tags?account_id=${activeAccountId}`),
      ]);
      const [bcData, tagData] = await Promise.all([bcRes.json(), tagRes.json()]);
      setBroadcasts(bcData.broadcasts ?? []);
      setTags(tagData.tags ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadData(); }, [loadData]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  async function sendNow(broadcastId: string) {
    setSending(broadcastId);
    try {
      await fetch("/api/broadcasts/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({ broadcast_id: broadcastId }),
      });
      loadData();
    } catch {
      // silent
    } finally {
      setSending(null);
    }
  }

  async function deleteBroadcast(id: string) {
    try {
      await fetch(`/api/broadcasts?id=${id}`, {
        method: "DELETE",
        headers: { "x-api-secret": DASHBOARD_SECRET },
      });
      loadData();
    } catch {
      // silent
    }
  }

  const drafts = broadcasts.filter((b) => b.status === "draft");
  const others = broadcasts.filter((b) => b.status !== "draft");

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
            <h2 className="page-title">Broadcasts</h2>
            <p className="page-subtitle">
              {loading
                ? "Loading..."
                : `${broadcasts.length} broadcasts · ${drafts.length} draft`}
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Create Broadcast
          </button>
        </div>

        {loading ? (
          <div className="page-loading">Loading...</div>
        ) : broadcasts.length === 0 ? (
          <div className="page-empty">
            No broadcasts yet. Create one to DM your entire subscriber list at once.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Clicked</th>
                  <th>Scheduled</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((bc) => (
                  <tr key={bc.id} className="table-row">
                    <td>
                      <div style={{ fontWeight: 600 }}>{bc.name}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 2,
                          maxWidth: 260,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {bc.message}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={bc.status} />
                    </td>
                    <td className="table-cell-mono">{bc.total_recipients}</td>
                    <td className="table-cell-mono">{bc.total_sent}</td>
                    <td className="table-cell-mono">{bc.total_clicked}</td>
                    <td className="table-cell-mono" style={{ color: "var(--text-muted)" }}>
                      {bc.scheduled_at
                        ? new Date(bc.scheduled_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="table-cell-mono">
                      {formatRelativeTime(bc.created_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {bc.status === "draft" && (
                          <button
                            className="btn-primary"
                            style={{ padding: "4px 12px", fontSize: 11 }}
                            onClick={() => sendNow(bc.id)}
                            disabled={sending === bc.id}
                          >
                            {sending === bc.id ? "Sending..." : "Send Now"}
                          </button>
                        )}
                        {(bc.status === "draft" || bc.status === "scheduled") && (
                          <button
                            className="btn-ghost-danger"
                            onClick={() => deleteBroadcast(bc.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showCreate && activeAccountId && (
        <CreateBroadcastModal
          accountId={activeAccountId}
          tags={tags}
          onCreated={loadData}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
