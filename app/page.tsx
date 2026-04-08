"use client";

import { useCallback, useEffect, useState } from "react";
import { DMThread, Account, fetchThreads, fetchAccounts } from "@/lib/db";
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
      const data = await fetchAccounts();
      setAccounts(data);
      if (data.length > 0 && !activeAccountId) {
        setActiveAccountId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }, [activeAccountId]);

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchThreads(activeAccountId || undefined);
      setThreads(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load threads:", err);
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
          <h1 className="brand">
            <span className="brand-icon">&#9674;</span> ig-setter
            <span className="brand-pro">PRO</span>
          </h1>
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
