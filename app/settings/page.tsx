"use client";

import { useCallback, useEffect, useState } from "react";
import type { Account, WelcomeMessage, QuickReply, GrowthTool } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import { formatRelativeTime } from "@/lib/types";

const DASHBOARD_SECRET = "DASHBOARD_SECRET";

function Toggle({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <div
      className={`auto-send-toggle ${enabled ? "auto-send-toggle--on" : "auto-send-toggle--off"}`}
      onClick={onToggle}
      style={{ padding: "4px 10px", gap: 8, cursor: "pointer" }}
    >
      <div
        className={`auto-send-switch ${enabled ? "auto-send-switch--on" : "auto-send-switch--off"}`}
      />
      {label && <span style={{ fontSize: 12 }}>{label}</span>}
    </div>
  );
}

function SettingsSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <h3 className="settings-section-title">{title}</h3>
        {subtitle && (
          <p className="settings-section-sub">{subtitle}</p>
        )}
      </div>
      <div className="settings-section-body">{children}</div>
    </div>
  );
}

interface CreateQuickReplyProps {
  accountId: string;
  onCreated: () => void;
  onClose: () => void;
}

function CreateQuickReplyModal({ accountId, onCreated, onClose }: CreateQuickReplyProps) {
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !message.trim()) {
      setError("Label and message are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/quick-replies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({
          account_id: accountId,
          label: label.trim(),
          message: message.trim(),
          category: category.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create quick reply");
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
          <span className="modal-title">Create Quick Reply</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <label className="form-label">Label *</label>
          <input
            className="form-input"
            placeholder="e.g. Objection: Too expensive"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
          <label className="form-label" style={{ marginTop: 12 }}>Message *</label>
          <textarea
            className="form-textarea"
            placeholder="I totally get that. Just to be clear — this isn't a cost, it's a..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
          <label className="form-label" style={{ marginTop: 12 }}>Category (optional)</label>
          <input
            className="form-input"
            placeholder="e.g. Objections, Openers, Closers"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Quick Reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CreateGrowthToolProps {
  accountId: string;
  onCreated: () => void;
  onClose: () => void;
}

function CreateGrowthToolModal({ accountId, onCreated, onClose }: CreateGrowthToolProps) {
  const [name, setName] = useState("");
  const [toolType, setToolType] = useState<GrowthTool["tool_type"]>("ref_url");
  const [slug, setSlug] = useState("");
  const [autoDmMessage, setAutoDmMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/growth-tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({
          account_id: accountId,
          name: name.trim(),
          tool_type: toolType,
          slug: slug.trim(),
          auto_dm_message: autoDmMessage.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create growth tool");
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
          <span className="modal-title">Create Growth Tool</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            placeholder="e.g. Bio Link QR Code"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Type</label>
              <select
                className="filter-select"
                style={{ width: "100%" }}
                value={toolType}
                onChange={(e) => setToolType(e.target.value as GrowthTool["tool_type"])}
              >
                <option value="ref_url">Referral URL</option>
                <option value="qr_code">QR Code</option>
                <option value="opt_in_keyword">Opt-in Keyword</option>
                <option value="landing_page">Landing Page</option>
              </select>
            </div>
            <div>
              <label className="form-label">Slug *</label>
              <input
                className="form-input"
                placeholder="free-guide"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
          </div>
          <label className="form-label" style={{ marginTop: 12 }}>Auto DM Message (optional)</label>
          <textarea
            className="form-textarea"
            placeholder="Hey! Thanks for scanning my QR code. Here's what I promised..."
            value={autoDmMessage}
            onChange={(e) => setAutoDmMessage(e.target.value)}
            rows={3}
          />
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Tool"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<WelcomeMessage | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [growthTools, setGrowthTools] = useState<GrowthTool[]>([]);

  const [wmMessage, setWmMessage] = useState("");
  const [wmButtonText, setWmButtonText] = useState("");
  const [wmButtonUrl, setWmButtonUrl] = useState("");
  const [wmActive, setWmActive] = useState(true);
  const [wmSaving, setWmSaving] = useState(false);
  const [wmSaved, setWmSaved] = useState(false);

  const [showCreateQR, setShowCreateQR] = useState(false);
  const [showCreateGT, setShowCreateGT] = useState(false);
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
      const [wmRes, qrRes, gtRes] = await Promise.all([
        fetch(`/api/welcome-message?account_id=${activeAccountId}`),
        fetch(`/api/quick-replies?account_id=${activeAccountId}`),
        fetch(`/api/growth-tools?account_id=${activeAccountId}`),
      ]);
      const [wmData, qrData, gtData] = await Promise.all([
        wmRes.json(),
        qrRes.json(),
        gtRes.json(),
      ]);

      const wm: WelcomeMessage | null = wmData.welcome_message ?? null;
      setWelcomeMessage(wm);
      if (wm) {
        setWmMessage(wm.message);
        setWmButtonText(wm.button_text ?? "");
        setWmButtonUrl(wm.button_url ?? "");
        setWmActive(Boolean(wm.is_active));
      }

      setQuickReplies(qrData.quick_replies ?? []);
      setGrowthTools(gtData.growth_tools ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadData(); }, [loadData]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  async function saveWelcomeMessage() {
    if (!activeAccountId || !wmMessage.trim()) return;
    setWmSaving(true);
    setWmSaved(false);
    try {
      await fetch("/api/welcome-message", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({
          account_id: activeAccountId,
          message: wmMessage.trim(),
          is_active: wmActive,
          button_text: wmButtonText.trim() || null,
          button_url: wmButtonUrl.trim() || null,
        }),
      });
      setWmSaved(true);
      setTimeout(() => setWmSaved(false), 3000);
      loadData();
    } catch {
      // silent
    } finally {
      setWmSaving(false);
    }
  }

  async function deleteQuickReply(id: string) {
    try {
      await fetch(`/api/quick-replies?id=${id}`, {
        method: "DELETE",
        headers: { "x-api-secret": DASHBOARD_SECRET },
      });
      loadData();
    } catch {
      // silent
    }
  }

  async function deleteGrowthTool(id: string) {
    try {
      await fetch(`/api/growth-tools?id=${id}`, {
        method: "DELETE",
        headers: { "x-api-secret": DASHBOARD_SECRET },
      });
      loadData();
    } catch {
      // silent
    }
  }

  const TOOL_TYPE_LABELS: Record<GrowthTool["tool_type"], string> = {
    ref_url: "Referral URL",
    qr_code: "QR Code",
    opt_in_keyword: "Opt-in Keyword",
    landing_page: "Landing Page",
  };

  return (
    <div className="app-shell">
      <Sidebar
        accounts={accounts}
        activeAccountId={activeAccountId}
        onAccountChange={(id) => setActiveAccountId(id)}
        activeAccount={activeAccount}
      />

      <main className="page-main page-main--settings">
        <div className="page-header">
          <div>
            <h2 className="page-title">Settings</h2>
            <p className="page-subtitle">Account configuration and tools</p>
          </div>
        </div>

        {loading ? (
          <div className="page-loading">Loading settings...</div>
        ) : (
          <div className="settings-stack">
            <SettingsSection
              title="Account Settings"
              subtitle="Your connected Instagram account details"
            >
              {activeAccount ? (
                <div className="settings-info-grid">
                  <div className="settings-info-row">
                    <span className="settings-info-label">Username</span>
                    <span className="settings-info-value">@{activeAccount.ig_username}</span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Display Name</span>
                    <span className="settings-info-value">{activeAccount.display_name}</span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Token Expires</span>
                    <span
                      className="settings-info-value"
                      style={{ color: activeAccount.token_expires_at ? "var(--text)" : "#ef4444" }}
                    >
                      {activeAccount.token_expires_at
                        ? formatRelativeTime(activeAccount.token_expires_at)
                        : "No token"}
                    </span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Auto-Send</span>
                    <Toggle
                      enabled={Boolean(activeAccount.auto_send_enabled)}
                      onToggle={async () => {
                        try {
                          await fetch("/api/accounts", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              id: activeAccount.id,
                              auto_send_enabled: !activeAccount.auto_send_enabled,
                            }),
                          });
                          loadAccounts();
                        } catch {
                          // silent
                        }
                      }}
                      label={activeAccount.auto_send_enabled ? "Enabled" : "Disabled"}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  No account selected
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              title="Welcome Message"
              subtitle="Automatically sent when a new subscriber first messages you"
            >
              <div className="form-toggle-row" style={{ marginBottom: 16 }}>
                <span className="settings-info-label">Welcome Message Active</span>
                <Toggle
                  enabled={wmActive}
                  onToggle={() => setWmActive((v) => !v)}
                  label={wmActive ? "On" : "Off"}
                />
              </div>
              <label className="form-label">Message *</label>
              <textarea
                className="form-textarea"
                placeholder="Hey! Thanks for reaching out. I'm not sure if I can help yet, but what's going on?"
                value={wmMessage}
                onChange={(e) => setWmMessage(e.target.value)}
                rows={4}
              />
              <div className="form-grid-2" style={{ marginTop: 12 }}>
                <div>
                  <label className="form-label">Button Text (optional)</label>
                  <input
                    className="form-input"
                    placeholder="Learn more →"
                    value={wmButtonText}
                    onChange={(e) => setWmButtonText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Button URL (optional)</label>
                  <input
                    className="form-input"
                    placeholder="https://..."
                    value={wmButtonUrl}
                    onChange={(e) => setWmButtonUrl(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
                <button
                  className="btn-primary"
                  onClick={saveWelcomeMessage}
                  disabled={wmSaving || !wmMessage.trim()}
                >
                  {wmSaving ? "Saving..." : "Save Welcome Message"}
                </button>
                {wmSaved && (
                  <span style={{ color: "var(--mint)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    Saved ✓
                  </span>
                )}
              </div>
              {welcomeMessage && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Sent {welcomeMessage.times_sent} times
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              title="Quick Replies"
              subtitle="Saved responses you can fire instantly in any conversation"
            >
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button className="btn-primary" onClick={() => setShowCreateQR(true)}>
                  + Add Quick Reply
                </button>
              </div>
              {quickReplies.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  No quick replies yet. Add your best objection handlers, openers, and closers.
                </div>
              ) : (
                <div className="qr-list">
                  {quickReplies.map((qr) => (
                    <div key={qr.id} className="qr-item">
                      <div className="qr-item-header">
                        <span className="qr-label">{qr.label}</span>
                        {qr.category && (
                          <span className="keyword-pill">{qr.category}</span>
                        )}
                        <span className="table-cell-mono" style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
                          used {qr.times_used}x
                        </span>
                        <button
                          className="btn-ghost-danger"
                          onClick={() => deleteQuickReply(qr.id)}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="qr-message">{qr.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              title="Growth Tools"
              subtitle="QR codes and referral links that auto-DM new subscribers"
            >
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button className="btn-primary" onClick={() => setShowCreateGT(true)}>
                  + Create Growth Tool
                </button>
              </div>
              {growthTools.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  No growth tools yet. Create a referral link or QR code to auto-add subscribers.
                </div>
              ) : (
                <div className="table-container" style={{ marginTop: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Slug</th>
                        <th>Hits</th>
                        <th>Conversions</th>
                        <th>Active</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {growthTools.map((gt) => (
                        <tr key={gt.id} className="table-row">
                          <td style={{ fontWeight: 600 }}>{gt.name}</td>
                          <td>
                            <span className="keyword-pill">
                              {TOOL_TYPE_LABELS[gt.tool_type] ?? gt.tool_type}
                            </span>
                          </td>
                          <td className="table-cell-mono">{gt.slug}</td>
                          <td className="table-cell-mono">{gt.total_hits}</td>
                          <td className="table-cell-mono">{gt.total_conversions}</td>
                          <td>
                            <span
                              style={{
                                fontSize: 11,
                                color: gt.is_active ? "var(--mint)" : "var(--text-muted)",
                              }}
                            >
                              {gt.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-ghost-danger"
                              onClick={() => deleteGrowthTool(gt.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SettingsSection>
          </div>
        )}
      </main>

      {showCreateQR && activeAccountId && (
        <CreateQuickReplyModal
          accountId={activeAccountId}
          onCreated={loadData}
          onClose={() => setShowCreateQR(false)}
        />
      )}
      {showCreateGT && activeAccountId && (
        <CreateGrowthToolModal
          accountId={activeAccountId}
          onCreated={loadData}
          onClose={() => setShowCreateGT(false)}
        />
      )}
    </div>
  );
}
