"use client";

import { usePathname } from "next/navigation";
import AccountSwitcher from "@/components/AccountSwitcher";
import AutoSendToggle from "@/components/AutoSendToggle";
import DaemonStatus from "@/components/DaemonStatus";
import type { Account } from "@/lib/db";

interface SidebarProps {
  accounts: Account[];
  activeAccountId: string | null;
  onAccountChange: (id: string) => void;
  activeAccount: Account | null;
  onRefresh?: () => void;
}

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Inbox", href: "/", icon: "▤" },
      { label: "Triggers", href: "/triggers", icon: "◆" },
      { label: "Doctrine", href: "/doctrine", icon: "◇" },
      { label: "Analytics", href: "/analytics", icon: "▦" },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/settings", icon: "✦" }],
  },
];

export default function Sidebar({
  accounts,
  activeAccountId,
  onAccountChange,
  activeAccount,
  onRefresh,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <a href="/" className="brand-link">
        <h1 className="brand">
          <span className="brand-icon">◈</span>
          PULSE
          <span className="brand-by">by OASIS</span>
        </h1>
      </a>

      <div className="app-sidebar__account">
        <AccountSwitcher
          accounts={accounts}
          activeId={activeAccountId}
          onSelect={onAccountChange}
        />
      </div>

      <nav className="app-sidebar__nav">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="app-sidebar__group">
            {group.label && (
              <div className="app-sidebar__group-label">{group.label}</div>
            )}
            {group.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`app-sidebar__item${isActive ? " app-sidebar__item--active" : ""}`}
                >
                  <span className="app-sidebar__item-icon">{item.icon}</span>
                  <span className="app-sidebar__item-label">{item.label}</span>
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <DaemonStatus />
        {activeAccount && (
          <div className="app-sidebar__auto-send">
            <AutoSendToggle
              accountId={activeAccount.id}
              enabled={Boolean(activeAccount.auto_send_enabled)}
              onToggle={() => onRefresh?.()}
            />
          </div>
        )}
        <div className="app-sidebar__user">
          <div className="user-avatar">
            {activeAccount?.ig_username?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="app-sidebar__user-meta">
            <div className="app-sidebar__user-name">
              {activeAccount?.ig_username
                ? `@${activeAccount.ig_username}`
                : "No account"}
            </div>
            <div className="app-sidebar__user-status">PULSE v1</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
