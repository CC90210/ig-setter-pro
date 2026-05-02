"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import StatusBanner from "@/components/StatusBanner";
import type { Account } from "@/lib/db";

interface AppShellProps {
  accounts: Account[];
  activeAccountId: string | null;
  onAccountChange: (id: string) => void;
  activeAccount: Account | null;
  onRefresh?: () => void;
  title: string;
  subtitle?: string;
  topRight?: ReactNode;
  children: ReactNode;
}

export default function AppShell({
  accounts,
  activeAccountId,
  onAccountChange,
  activeAccount,
  onRefresh,
  title,
  subtitle,
  topRight,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar
        accounts={accounts}
        activeAccountId={activeAccountId}
        onAccountChange={onAccountChange}
        activeAccount={activeAccount}
        onRefresh={onRefresh}
      />

      <div className="app-shell__body">
        <StatusBanner />

        <header className="app-shell__topbar">
          <div className="app-shell__topbar-title">
            <h2>{title}</h2>
            {subtitle && <span>{subtitle}</span>}
          </div>
          {topRight && <div>{topRight}</div>}
        </header>

        <main className="app-shell__page">{children}</main>
      </div>
    </div>
  );
}
