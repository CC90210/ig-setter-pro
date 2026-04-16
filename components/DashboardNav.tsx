"use client";

import { usePathname } from "next/navigation";
import AccountSwitcher from "@/components/AccountSwitcher";
import AutoSendToggle from "@/components/AutoSendToggle";
import type { Account } from "@/lib/db";

interface DashboardNavProps {
  accounts: Account[];
  activeAccountId: string | null;
  onAccountChange: (id: string) => void;
  activeAccount: Account | null;
  onRefresh?: () => void;
}

const NAV_TABS = [
  { label: "Inbox", href: "/" },
  { label: "Subscribers", href: "/subscribers" },
  { label: "Automations", href: "/automations" },
  { label: "Broadcasts", href: "/broadcasts" },
  { label: "Analytics", href: "/analytics" },
  { label: "Settings", href: "/settings" },
];

export default function DashboardNav({
  accounts,
  activeAccountId,
  onAccountChange,
  activeAccount,
  onRefresh,
}: DashboardNavProps) {
  const pathname = usePathname();

  return (
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
          {NAV_TABS.map((tab) => {
            const isActive =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            return (
              <a
                key={tab.href}
                href={tab.href}
                className={`nav-tab${isActive ? " nav-tab--active" : ""}`}
              >
                {tab.label}
              </a>
            );
          })}
        </nav>
        <AccountSwitcher
          accounts={accounts}
          activeId={activeAccountId}
          onSelect={(id) => onAccountChange(id)}
        />
      </div>
      <div className="navbar-right">
        {activeAccount && (
          <AutoSendToggle
            accountId={activeAccount.id}
            enabled={Boolean(activeAccount.auto_send_enabled)}
            onToggle={() => onRefresh?.()}
          />
        )}
        <div className="user-avatar">
          {activeAccount?.ig_username?.[0]?.toUpperCase() || "?"}
        </div>
      </div>
    </header>
  );
}
