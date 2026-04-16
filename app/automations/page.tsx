"use client";

import { useCallback, useEffect, useState } from "react";
import type { Account, AutomationRule, Sequence } from "@/lib/db";
import DashboardNav from "@/components/DashboardNav";
import { formatRelativeTime } from "@/lib/types";

const DASHBOARD_SECRET = "DASHBOARD_SECRET";

interface CommentTrigger {
  id: string;
  account_id: string;
  name: string;
  ig_media_id: string | null;
  keywords: string;
  match_type: "exact" | "contains" | "any_comment";
  require_follow: number;
  dm_message: string;
  dm_button_text: string | null;
  dm_button_url: string | null;
  follow_gate_message: string | null;
  is_active: number;
  times_triggered: number;
  times_sent: number;
  times_follow_gated: number;
  created_at: string;
}

interface SequenceWithSteps extends Sequence {
  sequence_steps: Array<{
    id: string;
    step_order: number;
    delay_minutes: number;
    message_template: string;
    condition: string | null;
  }>;
}

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`auto-send-toggle ${enabled ? "auto-send-toggle--on" : "auto-send-toggle--off"}`}
      onClick={onToggle}
      style={{ padding: "3px 8px", gap: 6 }}
    >
      <div
        className={`auto-send-switch ${enabled ? "auto-send-switch--on" : "auto-send-switch--off"}`}
      />
    </div>
  );
}

interface CreateTriggerModalProps {
  accountId: string;
  onCreated: () => void;
  onClose: () => void;
}

function CreateTriggerModal({ accountId, onCreated, onClose }: CreateTriggerModalProps) {
  const [form, setForm] = useState({
    name: "",
    ig_media_id: "",
    keywords: "",
    match_type: "contains",
    require_follow: true,
    dm_message: "",
    dm_button_text: "",
    dm_button_url: "",
    follow_gate_message: "Follow me first, then comment again to unlock!",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.keywords.trim() || !form.dm_message.trim()) {
      setError("Name, keywords, and DM message are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/comment-triggers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({
          account_id: accountId,
          name: form.name.trim(),
          ig_media_id: form.ig_media_id.trim() || undefined,
          keywords: form.keywords.trim(),
          match_type: form.match_type,
          require_follow: form.require_follow,
          dm_message: form.dm_message.trim(),
          dm_button_text: form.dm_button_text.trim() || undefined,
          dm_button_url: form.dm_button_url.trim() || undefined,
          follow_gate_message: form.follow_gate_message.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create trigger");
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
          <span className="modal-title">Create Comment Trigger</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div className="form-grid-2">
            <div>
              <label className="form-label">Trigger Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Free Guide Trigger"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">IG Media ID (optional)</label>
              <input
                className="form-input"
                placeholder="Leave blank for all posts"
                value={form.ig_media_id}
                onChange={(e) => set("ig_media_id", e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Keywords (comma-separated) *</label>
              <input
                className="form-input"
                placeholder="free, guide, send it"
                value={form.keywords}
                onChange={(e) => set("keywords", e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Match Type</label>
              <select
                className="filter-select"
                style={{ width: "100%" }}
                value={form.match_type}
                onChange={(e) => set("match_type", e.target.value)}
              >
                <option value="contains">Contains keyword</option>
                <option value="exact">Exact match</option>
                <option value="any_comment">Any comment</option>
              </select>
            </div>
          </div>

          <div className="form-toggle-row" style={{ marginTop: 12 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>
              Require Follow to Unlock
            </label>
            <Toggle
              enabled={form.require_follow}
              onToggle={() => set("require_follow", !form.require_follow)}
            />
          </div>

          <label className="form-label" style={{ marginTop: 12 }}>DM Message *</label>
          <textarea
            className="form-textarea"
            placeholder="Hey {{first_name}}! Here's your free guide..."
            value={form.dm_message}
            onChange={(e) => set("dm_message", e.target.value)}
            rows={3}
          />

          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Button Text (optional)</label>
              <input
                className="form-input"
                placeholder="Get the guide →"
                value={form.dm_button_text}
                onChange={(e) => set("dm_button_text", e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Button URL (optional)</label>
              <input
                className="form-input"
                placeholder="https://..."
                value={form.dm_button_url}
                onChange={(e) => set("dm_button_url", e.target.value)}
              />
            </div>
          </div>

          <label className="form-label" style={{ marginTop: 12 }}>Follow Gate Message</label>
          <input
            className="form-input"
            value={form.follow_gate_message}
            onChange={(e) => set("follow_gate_message", e.target.value)}
          />

          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Trigger"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CreateRuleModalProps {
  accountId: string;
  onCreated: () => void;
  onClose: () => void;
}

function CreateRuleModal({ accountId, onCreated, onClose }: CreateRuleModalProps) {
  const [form, setForm] = useState({
    name: "",
    trigger_type: "keyword",
    trigger_value: "",
    action_type: "send_message",
    action_value: "",
    priority: "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({
          account_id: accountId,
          name: form.name.trim(),
          trigger_type: form.trigger_type,
          trigger_value: form.trigger_value.trim(),
          action_type: form.action_type,
          action_value: form.action_value.trim(),
          priority: parseInt(form.priority, 10) || 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create rule");
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
          <span className="modal-title">Create Automation Rule</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <label className="form-label">Rule Name *</label>
          <input
            className="form-input"
            placeholder="e.g. Price objection handler"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            autoFocus
          />

          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Trigger Type</label>
              <select
                className="filter-select"
                style={{ width: "100%" }}
                value={form.trigger_type}
                onChange={(e) => set("trigger_type", e.target.value)}
              >
                <option value="keyword">Keyword</option>
                <option value="story_reply">Story Reply</option>
                <option value="first_message">First Message</option>
                <option value="status_change">Status Change</option>
              </select>
            </div>
            <div>
              <label className="form-label">Trigger Value</label>
              <input
                className="form-input"
                placeholder="e.g. price, cost, how much"
                value={form.trigger_value}
                onChange={(e) => set("trigger_value", e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Action Type</label>
              <select
                className="filter-select"
                style={{ width: "100%" }}
                value={form.action_type}
                onChange={(e) => set("action_type", e.target.value)}
              >
                <option value="send_message">Send Message</option>
                <option value="change_status">Change Status</option>
                <option value="start_sequence">Start Sequence</option>
                <option value="notify">Notify</option>
              </select>
            </div>
            <div>
              <label className="form-label">Priority (0 = highest)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              />
            </div>
          </div>

          <label className="form-label" style={{ marginTop: 12 }}>Action Value</label>
          <textarea
            className="form-textarea"
            placeholder="Message to send, status to set, sequence ID to start..."
            value={form.action_value}
            onChange={(e) => set("action_value", e.target.value)}
            rows={3}
          />

          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CreateSequenceModalProps {
  accountId: string;
  onCreated: () => void;
  onClose: () => void;
}

function CreateSequenceModal({ accountId, onCreated, onClose }: CreateSequenceModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState([
    { step_order: 1, delay_minutes: 0, message_template: "", condition: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addStep() {
    setSteps((s) => [
      ...s,
      {
        step_order: s.length + 1,
        delay_minutes: 60,
        message_template: "",
        condition: "",
      },
    ]);
  }

  function updateStep(index: number, key: string, value: string | number) {
    setSteps((s) =>
      s.map((step, i) => (i === index ? { ...step, [key]: value } : step))
    );
  }

  function removeStep(index: number) {
    setSteps((s) => s.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (steps.some((s) => !s.message_template.trim())) {
      setError("All steps must have a message");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({
          account_id: accountId,
          name: name.trim(),
          description: description.trim() || undefined,
          steps: steps.map((s, i) => ({
            step_order: i + 1,
            delay_minutes: s.delay_minutes,
            message_template: s.message_template.trim(),
            condition: s.condition.trim() || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create sequence");
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
          <span className="modal-title">Create Sequence</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <label className="form-label">Sequence Name *</label>
          <input
            className="form-input"
            placeholder="e.g. 5-Day Nurture Flow"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <label className="form-label" style={{ marginTop: 12 }}>Description</label>
          <input
            className="form-input"
            placeholder="What this sequence does..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="form-label" style={{ marginBottom: 0 }}>
                Steps (${steps.length})
              </span>
              <button type="button" className="btn-secondary" onClick={addStep}>
                + Add Step
              </button>
            </div>
            <div className="sequence-steps-list">
              {steps.map((step, i) => (
                <div key={i} className="sequence-step-card">
                  <div className="sequence-step-header">
                    <span className="sequence-step-num">Step {i + 1}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Delay:
                      </span>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={step.delay_minutes}
                        onChange={(e) =>
                          updateStep(i, "delay_minutes", parseInt(e.target.value, 10) || 0)
                        }
                        style={{ width: 70 }}
                      />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>min</span>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          className="btn-ghost-danger"
                          onClick={() => removeStep(i)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    className="form-textarea"
                    placeholder={`Message for step ${i + 1}...`}
                    value={step.message_template}
                    onChange={(e) => updateStep(i, "message_template", e.target.value)}
                    rows={2}
                    style={{ marginTop: 8 }}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Sequence"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type AutomationTab = "triggers" | "rules" | "sequences";

export default function AutomationsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [tab, setTab] = useState<AutomationTab>("triggers");

  const [triggers, setTriggers] = useState<CommentTrigger[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [sequences, setSequences] = useState<SequenceWithSteps[]>([]);

  const [showCreateTrigger, setShowCreateTrigger] = useState(false);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [showCreateSeq, setShowCreateSeq] = useState(false);
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
      const [trigRes, ruleRes, seqRes] = await Promise.all([
        fetch(`/api/comment-triggers?account_id=${activeAccountId}`),
        fetch(`/api/automations?account_id=${activeAccountId}`),
        fetch(`/api/sequences?account_id=${activeAccountId}`),
      ]);
      const [trigData, ruleData, seqData] = await Promise.all([
        trigRes.json(),
        ruleRes.json(),
        seqRes.json(),
      ]);
      setTriggers(trigData.triggers ?? []);
      setRules(ruleData.rules ?? []);
      setSequences(seqData.sequences ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadData(); }, [loadData]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  async function toggleTrigger(trigger: CommentTrigger) {
    try {
      await fetch("/api/comment-triggers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": DASHBOARD_SECRET,
        },
        body: JSON.stringify({ id: trigger.id, is_active: !trigger.is_active }),
      });
      loadData();
    } catch {
      // silent
    }
  }

  async function deleteTrigger(id: string) {
    try {
      await fetch(`/api/comment-triggers?id=${id}`, {
        method: "DELETE",
        headers: { "x-api-secret": DASHBOARD_SECRET },
      });
      loadData();
    } catch {
      // silent
    }
  }

  async function deleteRule(id: string) {
    try {
      await fetch(`/api/automations?id=${id}`, {
        method: "DELETE",
        headers: { "x-api-secret": DASHBOARD_SECRET },
      });
      loadData();
    } catch {
      // silent
    }
  }

  async function deleteSequence(id: string) {
    try {
      await fetch(`/api/sequences?id=${id}`, {
        method: "DELETE",
        headers: { "x-api-secret": DASHBOARD_SECRET },
      });
      loadData();
    } catch {
      // silent
    }
  }

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
            <h2 className="page-title">Automations</h2>
            <p className="page-subtitle">Comment triggers, rules, and DM sequences</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {tab === "triggers" && (
              <button className="btn-primary" onClick={() => setShowCreateTrigger(true)}>
                + Create Trigger
              </button>
            )}
            {tab === "rules" && (
              <button className="btn-primary" onClick={() => setShowCreateRule(true)}>
                + Create Rule
              </button>
            )}
            {tab === "sequences" && (
              <button className="btn-primary" onClick={() => setShowCreateSeq(true)}>
                + Create Sequence
              </button>
            )}
          </div>
        </div>

        <div className="sub-tabs">
          {(["triggers", "rules", "sequences"] as AutomationTab[]).map((t) => (
            <button
              key={t}
              className={`sub-tab${tab === t ? " sub-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "triggers"
                ? `Comment Triggers (${triggers.length})`
                : t === "rules"
                ? `Automation Rules (${rules.length})`
                : `Sequences (${sequences.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="page-loading">Loading...</div>
        ) : (
          <>
            {tab === "triggers" && (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Keywords</th>
                      <th>Match Type</th>
                      <th>Scope</th>
                      <th>Triggered</th>
                      <th>Sent</th>
                      <th>Follow-Gated</th>
                      <th>Active</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {triggers.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                          No comment triggers yet. Create one to turn comments into DMs.
                        </td>
                      </tr>
                    ) : (
                      triggers.map((t) => (
                        <tr key={t.id} className="table-row">
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td>
                            <span className="keyword-pills">
                              {t.keywords.split(",").slice(0, 3).map((k) => (
                                <span key={k} className="keyword-pill">{k.trim()}</span>
                              ))}
                            </span>
                          </td>
                          <td className="table-cell-mono">{t.match_type}</td>
                          <td className="table-cell-mono" style={{ color: "var(--text-muted)" }}>
                            {t.ig_media_id ? "Post-specific" : "Global"}
                          </td>
                          <td className="table-cell-mono">{t.times_triggered ?? 0}</td>
                          <td className="table-cell-mono">{t.times_sent ?? 0}</td>
                          <td className="table-cell-mono">{t.times_follow_gated ?? 0}</td>
                          <td>
                            <Toggle
                              enabled={Boolean(t.is_active)}
                              onToggle={() => toggleTrigger(t)}
                            />
                          </td>
                          <td>
                            <button
                              className="btn-ghost-danger"
                              onClick={() => deleteTrigger(t.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "rules" && (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Trigger</th>
                      <th>Action</th>
                      <th>Priority</th>
                      <th>Times Triggered</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                          No automation rules yet.
                        </td>
                      </tr>
                    ) : (
                      rules.map((rule) => (
                        <tr key={rule.id} className="table-row">
                          <td style={{ fontWeight: 600 }}>{rule.name}</td>
                          <td>
                            <div className="table-cell-stack">
                              <span className="keyword-pill">{rule.trigger_type}</span>
                              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                {rule.trigger_value}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="table-cell-stack">
                              <span className="keyword-pill" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" }}>
                                {rule.action_type}
                              </span>
                            </div>
                          </td>
                          <td className="table-cell-mono">{rule.priority}</td>
                          <td className="table-cell-mono">{rule.times_triggered}</td>
                          <td className="table-cell-mono">
                            {formatRelativeTime(rule.created_at)}
                          </td>
                          <td>
                            <button
                              className="btn-ghost-danger"
                              onClick={() => deleteRule(rule.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "sequences" && (
              <div className="cards-grid">
                {sequences.length === 0 ? (
                  <div className="page-empty">
                    No sequences yet. Create a multi-step DM flow to nurture leads automatically.
                  </div>
                ) : (
                  sequences.map((seq) => (
                    <div key={seq.id} className="sequence-card">
                      <div className="sequence-card-header">
                        <div>
                          <div className="sequence-card-name">{seq.name}</div>
                          {seq.description && (
                            <div className="sequence-card-desc">{seq.description}</div>
                          )}
                        </div>
                        <button
                          className="btn-ghost-danger"
                          onClick={() => deleteSequence(seq.id)}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="sequence-card-meta">
                        <span className="table-cell-mono">
                          {seq.sequence_steps?.length ?? 0} steps
                        </span>
                        <span className="table-cell-mono">
                          {seq.total_enrolled} enrolled
                        </span>
                        <span className="table-cell-mono">
                          {seq.total_completed} completed
                        </span>
                      </div>
                      <div className="sequence-steps-preview">
                        {(seq.sequence_steps ?? []).map((step, i) => (
                          <div key={step.id} className="sequence-step-preview">
                            <span className="sequence-step-num" style={{ fontSize: 10, padding: "2px 6px" }}>
                              {i + 1}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              {step.delay_minutes > 0 ? `+${step.delay_minutes}min — ` : "Immediately — "}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                              {step.message_template.slice(0, 60)}
                              {step.message_template.length > 60 ? "..." : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>

      {showCreateTrigger && activeAccountId && (
        <CreateTriggerModal
          accountId={activeAccountId}
          onCreated={loadData}
          onClose={() => setShowCreateTrigger(false)}
        />
      )}
      {showCreateRule && activeAccountId && (
        <CreateRuleModal
          accountId={activeAccountId}
          onCreated={loadData}
          onClose={() => setShowCreateRule(false)}
        />
      )}
      {showCreateSeq && activeAccountId && (
        <CreateSequenceModal
          accountId={activeAccountId}
          onCreated={loadData}
          onClose={() => setShowCreateSeq(false)}
        />
      )}
    </div>
  );
}
