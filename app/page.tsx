"use client";

import { useCallback, useEffect, useState } from "react";
import type { DMThread, Account } from "@/lib/db";
import { startPolling } from "@/lib/types";
import StatusBanner from "@/components/StatusBanner";
import StatsBar from "@/components/StatsBar";
import ThreadFeed from "@/components/ThreadFeed";
import ConversationChain from "@/components/ConversationChain";
import OverridePanel from "@/components/OverridePanel";
import DailySummary from "@/components/DailySummary";
import AccountSwitcher from "@/components/AccountSwitcher";
import AutoSendToggle from "@/components/AutoSendToggle";

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [threads, setThreads] = useState<DMThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      const accounts: Account[] = data.accounts ?? [];
      setAccounts(accounts);
      if (accounts.length > 0 && !activeAccountId) {
        setActiveAccountId(accounts[0].id);
      }
    } catch {
      // silently ignore — UI stays with last known state
    }
  }, [activeAccountId]);

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      const url = activeAccountId
        ? `/api/threads?account_id=${activeAccountId}`
        : "/api/threads";
      const res = await fetch(url);
      const data = await res.json();
      const threads: DMThread[] = data.threads ?? [];
      setThreads(threads);
      if (threads.length > 0 && !selectedId) {
        setSelectedId(threads[0].id);
      }
    } catch {
      // silently ignore — UI stays with last known state
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, selectedId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!activeAccountId) return;
    loadThreads();
    const stop = startPolling(() => loadThreads(), 3000);
    return stop;
  }, [activeAccountId, loadThreads]);

  const selectedThread = threads.find((t) => t.id === selectedId) || null;
  const activeAccount = accounts.find((a) => a.id === activeAccountId) || null;

  return (
    <div className="app">
      <StatusBanner />

      <header className="navbar">
        <div className="navbar-left">
          <a href="/" className="brand-link">
            <h1 className="brand">
              <span className="brand-icon">◈</span>
              PULSE
              <span className="brand-by">by OASIS</span>
            </h1>
          </a>
          <nav className="nav-tabs">
            <a href="/" className="nav-tab nav-tab--active">Inbox</a>
            <a href="/prospects" className="nav-tab">Prospects</a>
            <a href="/doctrine" className="nav-tab">Doctrine</a>
            <a href="/subscribers" className="nav-tab">Subscribers</a>
            <a href="/automations" className="nav-tab">Automations</a>
            <a href="/broadcasts" className="nav-tab">Broadcasts</a>
            <a href="/analytics" className="nav-tab">Analytics</a>
          </nav>
          <AccountSwitcher
            accounts={accounts}
            activeId={activeAccountId}
            onSelect={(id) => {
              setActiveAccountId(id);
              setSelectedId(null);
            }}
          />
        </div>
        <div className="navbar-center">
          <StatsBar accountId={activeAccountId} />
        </div>
        <div className="navbar-right">
          {activeAccount && (
            <AutoSendToggle
              accountId={activeAccount.id}
              enabled={Boolean(activeAccount.auto_send_enabled)}
              onToggle={() => loadAccounts()}
            />
          )}
          <div className="user-avatar">
            {activeAccount?.ig_username?.[0]?.toUpperCase() || "?"}
          </div>
        </div>
      </header>

      <main className="dashboard">
        <aside className="sidebar-left">
          <ThreadFeed
            threads={threads}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
          />
        </aside>

        <section className="main-panel">
          {selectedThread ? (
            <ConversationChain thread={selectedThread} />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">&#9674;</div>
              <p>Select a conversation to view</p>
            </div>
          )}
        </section>

        <aside className="sidebar-right">
          {selectedThread && <OverridePanel thread={selectedThread} />}
          <DailySummary accountId={activeAccountId} />
        </aside>
      </main>
    </div>
  );
}
