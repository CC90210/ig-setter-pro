"use client";

import { useCallback, useEffect, useState } from "react";
import type { Account } from "@/lib/db";
import Sidebar from "@/components/Sidebar";

interface CommentTrigger {
  id: string;
  account_id: string;
  name: string;
  ig_media_id: string | null;
  keywords: string;
  match_type: string;
  require_follow: number;
  dm_message: string;
  dm_button_text: string | null;
  dm_button_url: string | null;
  is_active: number;
  times_triggered: number;
  times_sent: number;
  times_follow_gated: number;
  created_at: string;
}

const DASHBOARD_SECRET =
  process.env.NEXT_PUBLIC_DASHBOARD_SECRET || "dashboard-secret";

function extractMediaId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  // Accept full URL, /p/<id>, /reel/<id>, or bare id
  const match = trimmed.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  return trimmed.replace(/^\/+|\/+$/g, "");
}

export default function TriggersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<CommentTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form state
  const [postInput, setPostInput] = useState("");
  const [keywords, setKeywords] = useState("");
  const [dmMessage, setDmMessage] = useState("");
  const [dmLink, setDmLink] = useState("");
  const [requireFollow, setRequireFollow] = useState(false);
  const [name, setName] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      const accts: Account[] = data.accounts ?? [];
      setAccounts(accts);
      if (accts.length > 0 && !activeAccountId) setActiveAccountId(accts[0].id);
    } catch {}
  }, [activeAccountId]);

  const loadTriggers = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/comment-triggers?account_id=${activeAccountId}`
      );
      const data = await res.json();
      setTriggers((data.triggers as CommentTrigger[]) ?? []);
    } catch {}
    setLoading(false);
  }, [activeAccountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  async function createTrigger() {
    if (!activeAccountId) return;
    if (!keywords.trim() || !dmMessage.trim()) {
      alert("Keyword and DM message are required.");
      return;
    }
    const mediaId = extractMediaId(postInput);
    if (!mediaId) {
      alert("Paste an Instagram post/reel URL or shortcode.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/comment-triggers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({
          account_id: activeAccountId,
          name: name.trim() || `Trigger · ${keywords.trim().slice(0, 24)}`,
          ig_media_id: mediaId,
          keywords: keywords.trim(),
          match_type: "contains",
          require_follow: requireFollow,
          dm_message: dmMessage.trim(),
          dm_button_url: dmLink.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Failed: ${data.error || res.statusText}`);
        return;
      }
      setShowCreate(false);
      setPostInput("");
      setKeywords("");
      setDmMessage("");
      setDmLink("");
      setRequireFollow(false);
      setName("");
      loadTriggers();
    } finally {
      setBusy(false);
    }
  }

  async function toggleTrigger(t: CommentTrigger) {
    await fetch("/api/comment-triggers", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": DASHBOARD_SECRET,
      },
      body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
    });
    loadTriggers();
  }

  async function deleteTrigger(id: string) {
    if (!confirm("Delete this trigger?")) return;
    await fetch(`/api/comment-triggers?id=${id}`, {
      method: "DELETE",
      headers: { "x-api-secret": DASHBOARD_SECRET },
    });
    loadTriggers();
  }

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  return (
    <div className="app-shell">
      <Sidebar
        accounts={accounts}
        activeAccountId={activeAccountId}
        onAccountChange={setActiveAccountId}
        activeAccount={activeAccount}
        onRefresh={loadAccounts}
      />

      <main className="page-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">Comment → DM Triggers</h2>
            <p className="page-subtitle">
              Register a post + keyword. When someone comments that word, the
              Python daemon DMs them the resource automatically.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "+ New trigger"}
          </button>
        </div>

        {showCreate && (
          <div className="trigger-form">
            <label className="form-row">
              <span className="form-label">Post URL or shortcode</span>
              <input
                type="text"
                placeholder="https://www.instagram.com/p/Cxxxxxx/  or  Cxxxxxx"
                value={postInput}
                onChange={(e) => setPostInput(e.target.value)}
              />
            </label>

            <label className="form-row">
              <span className="form-label">Keyword(s) — comma separated</span>
              <input
                type="text"
                placeholder='e.g. "guide, send, link"'
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </label>

            <label className="form-row">
              <span className="form-label">DM message they receive</span>
              <textarea
                placeholder="Hey! Here's the guide you asked about — let me know what you think 🎯"
                value={dmMessage}
                rows={4}
                onChange={(e) => setDmMessage(e.target.value)}
              />
            </label>

            <label className="form-row">
              <span className="form-label">Resource link (optional)</span>
              <input
                type="text"
                placeholder="https://oasisai.work/resource"
                value={dmLink}
                onChange={(e) => setDmLink(e.target.value)}
              />
            </label>

            <label className="form-row">
              <span className="form-label">Internal name (optional)</span>
              <input
                type="text"
                placeholder="e.g. April growth video"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="form-row form-row--inline">
              <input
                type="checkbox"
                checked={requireFollow}
                onChange={(e) => setRequireFollow(e.target.checked)}
              />
              <span>Require commenter to follow you first</span>
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-primary"
                onClick={createTrigger}
                disabled={busy}
              >
                {busy ? "Creating…" : "Create trigger"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="page-loading">Loading triggers…</div>
        ) : triggers.length === 0 ? (
          <div className="page-empty">
            No triggers yet. Add one — paste a post URL, the keyword commenters
            will use, and the DM you want sent.
          </div>
        ) : (
          <div className="trigger-list">
            {triggers.map((t) => (
              <div
                key={t.id}
                className={`trigger-card${t.is_active ? "" : " trigger-card--off"}`}
              >
                <div className="trigger-card__head">
                  <div>
                    <div className="trigger-card__name">{t.name}</div>
                    <div className="trigger-card__meta">
                      {t.ig_media_id ? (
                        <a
                          href={`https://www.instagram.com/p/${t.ig_media_id}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="trigger-card__post-link"
                        >
                          /p/{t.ig_media_id}
                        </a>
                      ) : (
                        <span className="trigger-card__post-link">
                          (any post)
                        </span>
                      )}
                      <span className="trigger-card__keyword">
                        keyword: <code>{t.keywords}</code>
                      </span>
                    </div>
                  </div>
                  <div className="trigger-card__actions">
                    <button
                      className="btn-secondary"
                      onClick={() => toggleTrigger(t)}
                    >
                      {t.is_active ? "Pause" : "Resume"}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => deleteTrigger(t.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="trigger-card__dm">{t.dm_message}</div>
                {t.dm_button_url && (
                  <div className="trigger-card__link">→ {t.dm_button_url}</div>
                )}
                <div className="trigger-card__stats">
                  <span>Triggered: {t.times_triggered}</span>
                  <span>Sent: {t.times_sent}</span>
                  {t.require_follow ? (
                    <span>Gated: {t.times_follow_gated}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
