"use client";

import { Account } from "@/lib/db";

interface AccountSwitcherProps {
  accounts: Account[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function AccountSwitcher({ accounts, activeId, onSelect }: AccountSwitcherProps) {
  if (accounts.length <= 1) {
    const acct = accounts[0];
    if (!acct) return null;
    return (
      <div className="account-switcher">
        <span className="account-switcher-dot" />
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>@{acct.ig_username}</span>
      </div>
    );
  }

  return (
    <div className="account-switcher">
      <span className="account-switcher-dot" />
      <select
        value={activeId || ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        {accounts.map((acct) => (
          <option key={acct.id} value={acct.id}>
            @{acct.ig_username} — {acct.display_name}
          </option>
        ))}
      </select>
    </div>
  );
}
