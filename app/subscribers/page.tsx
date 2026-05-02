"use client";

import { useCallback, useEffect, useState } from "react";
import type { Account, Subscriber, Tag } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import { formatRelativeTime } from "@/lib/types";

const DASHBOARD_SECRET = "DASHBOARD_SECRET";

// ─── Tag chip component ───────────────────────────────────────────────────────

function TagChip({ tag }: { tag: Tag }) {
  return (
    <span
      className="tag-chip"
      style={{
        background: tag.color + "22",
        color: tag.color,
        border: `1px solid ${tag.color}44`,
      }}
    >
      {tag.name}
    </span>
  );
}

// ─── Subscriber drawer ────────────────────────────────────────────────────────

interface DrawerProps {
  subscriber: Subscriber;
  allTags: Tag[];
  subscriberTagIds: string[];
  onClose: () => void;
  onTagsChanged: () => void;
  accountId: string;
}

function SubscriberDrawer({
  subscriber,
  allTags,
  subscriberTagIds,
  onClose,
  onTagsChanged,
  accountId,
}: DrawerProps) {
  const [saving, setSaving] = useState(false);

  async function toggleTag(tagId: string) {
    const hasTag = subscriberTagIds.includes(tagId);
    setSaving(true);
    try {
      if (hasTag) {
        await fetch(
          `/api/subscribers/tags?subscriber_id=${subscriber.id}&tag_id=${tagId}`,
          {
            method: "DELETE",
            headers: { "x-api-secret": DASHBOARD_SECRET },
          }
        );
      } else {
        await fetch("/api/subscribers/tags", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-secret": DASHBOARD_SECRET,
          },
          body: JSON.stringify({ subscriber_id: subscriber.id, tag_id: tagId }),
        });
      }
      onTagsChanged();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-avatar">
            {(subscriber.display_name || subscriber.username || "?")?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="drawer-username">
              @{subscriber.username || "unknown"}
            </div>
            <div className="drawer-display-name">{subscriber.display_name}</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-section">
          <div className="drawer-section-title">STATS</div>
          <div className="drawer-stat-row">
            <span className="drawer-stat-label">Lifetime Value</span>
            <span className="drawer-stat-value" style={{ color: "var(--mint)" }}>
              ${subscriber.lifetime_value?.toFixed(2) ?? "0.00"}
            </span>
          </div>
          <div className="drawer-stat-row">
            <span className="drawer-stat-label">First Seen</span>
            <span className="drawer-stat-value">
              {formatRelativeTime(subscriber.first_interaction_at)}
            </span>
          </div>
          <div className="drawer-stat-row">
            <span className="drawer-stat-label">Last Active</span>
            <span className="drawer-stat-value">
              {formatRelativeTime(subscriber.last_interaction_at)}
            </span>
          </div>
          <div className="drawer-stat-row">
            <span className="drawer-stat-label">Follower</span>
            <span className="drawer-stat-value">
              {subscriber.is_follower ? "Yes" : "No"}
            </span>
          </div>
          <div className="drawer-stat-row">
            <span className="drawer-stat-label">Opted In</span>
            <span className="drawer-stat-value">
              {subscriber.opted_in ? "Yes" : "No"}
            </span>
          </div>
          {subscriber.source && (
            <div className="drawer-stat-row">
              <span className="drawer-stat-label">Source</span>
              <span className="drawer-stat-value">{subscriber.source}</span>
            </div>
          )}
        </div>

        <div className="drawer-section">
          <div className="drawer-section-title">TAGS</div>
          <div className="drawer-tags-grid">
            {allTags.map((tag) => {
              const active = subscriberTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  className={`drawer-tag-btn${active ? " drawer-tag-btn--active" : ""}`}
                  style={
                    active
                      ? {
                          background: tag.color + "22",
                          color: tag.color,
                          border: `1px solid ${tag.color}66`,
                        }
                      : {}
                  }
                  onClick={() => toggleTag(tag.id)}
                  disabled={saving}
                >
                  {active ? "✓ " : "+ "}
                  {tag.name}
                </button>
              );
            })}
            {allTags.length === 0 && (
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                No tags created yet
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create Tag Modal ─────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#00FFAB", "#f59e0b", "#3b82f6", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#84cc16",
];

interface CreateTagModalProps {
  accountId: string;
  onCreated: () => void;
  onClose: () => void;
}

function CreateTagModal({ accountId, onCreated, onClose }: CreateTagModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#00FFAB");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({ account_id: accountId, name: name.trim(), color }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create tag");
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Create Tag</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <label className="form-label">Tag Name</label>
          <input
            className="form-input"
            placeholder="e.g. Hot Lead, VIP, Nurture"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <label className="form-label" style={{ marginTop: 16 }}>Color</label>
          <div className="color-picker-row">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch${color === c ? " color-swatch--active" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div
            className="tag-chip"
            style={{
              background: color + "22",
              color,
              border: `1px solid ${color}44`,
              marginTop: 12,
              display: "inline-flex",
            }}
          >
            {name || "Preview"}
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Tag"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface SubscriberWithTags extends Subscriber {
  tags: Tag[];
}

export default function SubscribersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<SubscriberWithTags[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [filterTagId, setFilterTagId] = useState<string>("all");
  const [selectedSubscriber, setSelectedSubscriber] = useState<SubscriberWithTags | null>(null);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const [subRes, tagRes] = await Promise.all([
        fetch(
          filterTagId !== "all"
            ? `/api/subscribers?account_id=${activeAccountId}&tag_id=${filterTagId}`
            : `/api/subscribers?account_id=${activeAccountId}`
        ),
        fetch(`/api/tags?account_id=${activeAccountId}`),
      ]);

      const subData = await subRes.json();
      const tagData = await tagRes.json();

      const fetchedTags: Tag[] = tagData.tags ?? [];
      setTags(fetchedTags);

      const rawSubs: Subscriber[] = subData.subscribers ?? [];

      const subTagMap = new Map<string, Tag[]>();
      for (const sub of rawSubs) {
        subTagMap.set(sub.id, []);
      }

      if (fetchedTags.length > 0) {
        const tagSubResults = await Promise.allSettled(
          fetchedTags.map((tag) =>
            fetch(`/api/subscribers?account_id=${activeAccountId}&tag_id=${tag.id}`)
              .then((r) => r.json())
              .then((d) => ({ tag, subs: (d.subscribers ?? []) as Subscriber[] }))
          )
        );
        for (const result of tagSubResults) {
          if (result.status === "fulfilled") {
            const { tag, subs } = result.value;
            for (const sub of subs) {
              const existing = subTagMap.get(sub.id) ?? [];
              if (!existing.find((t) => t.id === tag.id)) {
                existing.push(tag);
                subTagMap.set(sub.id, existing);
              }
            }
          }
        }
      }

      const enriched: SubscriberWithTags[] = rawSubs.map((s) => ({
        ...s,
        tags: subTagMap.get(s.id) ?? [],
      }));

      setSubscribers(enriched);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, filterTagId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadData(); }, [loadData]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  const filtered = subscribers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.username?.toLowerCase().includes(q) ||
      s.display_name?.toLowerCase().includes(q)
    );
  });

  const selectedTags = selectedSubscriber
    ? selectedSubscriber.tags.map((t) => t.id)
    : [];

  return (
    <div className="app-shell">
      <Sidebar
        accounts={accounts}
        activeAccountId={activeAccountId}
        onAccountChange={(id) => { setActiveAccountId(id); }}
        activeAccount={activeAccount}
      />

      <main className="page-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">Subscribers</h2>
            <p className="page-subtitle">
              {loading ? "Loading..." : `${subscribers.length} subscribers`}
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowCreateTag(true)}
          >
            + Create Tag
          </button>
        </div>

        <div className="table-toolbar">
          <input
            className="search-input"
            placeholder="Search by username or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={filterTagId}
            onChange={(e) => setFilterTagId(e.target.value)}
          >
            <option value="all">All Tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Subscriber</th>
                <th>Tags</th>
                <th>First Seen</th>
                <th>Last Active</th>
                <th>LTV</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    Loading subscribers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    {search ? "No subscribers match your search" : "No subscribers yet"}
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => (
                  <tr
                    key={sub.id}
                    className="table-row"
                    onClick={() => setSelectedSubscriber(sub)}
                  >
                    <td>
                      <div className="sub-cell">
                        <div className="sub-avatar">
                          {(sub.display_name || sub.username || "?")?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="sub-name">
                            {sub.display_name || sub.username}
                          </div>
                          <div className="sub-handle">@{sub.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="tag-chip-row">
                        {sub.tags.slice(0, 3).map((tag) => (
                          <TagChip key={tag.id} tag={tag} />
                        ))}
                        {sub.tags.length > 3 && (
                          <span className="tag-chip-more">
                            +{sub.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell-mono">
                      {formatRelativeTime(sub.first_interaction_at)}
                    </td>
                    <td className="table-cell-mono">
                      {formatRelativeTime(sub.last_interaction_at)}
                    </td>
                    <td className="table-cell-mono" style={{ color: "var(--mint)" }}>
                      ${sub.lifetime_value?.toFixed(2) ?? "0.00"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {selectedSubscriber && (
        <SubscriberDrawer
          subscriber={selectedSubscriber}
          allTags={tags}
          subscriberTagIds={selectedTags}
          accountId={activeAccountId!}
          onClose={() => setSelectedSubscriber(null)}
          onTagsChanged={() => {
            loadData();
            setSelectedSubscriber(null);
          }}
        />
      )}

      {showCreateTag && activeAccountId && (
        <CreateTagModal
          accountId={activeAccountId}
          onCreated={loadData}
          onClose={() => setShowCreateTag(false)}
        />
      )}
    </div>
  );
}
