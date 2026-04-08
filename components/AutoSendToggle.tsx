"use client";

import { useState } from "react";

interface AutoSendToggleProps {
  accountId: string;
  enabled: boolean;
  onToggle: () => void;
}

export default function AutoSendToggle({ accountId, enabled, onToggle }: AutoSendToggleProps) {
  const [updating, setUpdating] = useState(false);

  async function toggle() {
    if (updating) return;
    setUpdating(true);

    try {
      const res = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: accountId, auto_send_enabled: !enabled }),
      });

      if (res.ok) {
        onToggle();
      }
    } catch {
      // Silent fail — toggle will revert on next render
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className={`auto-send-toggle ${enabled ? "auto-send-toggle--on" : "auto-send-toggle--off"}`}
      onClick={toggle}
      style={{ opacity: updating ? 0.5 : 1 }}
    >
      <div className={`auto-send-switch ${enabled ? "auto-send-switch--on" : "auto-send-switch--off"}`} />
      <span>{enabled ? "AUTO-SEND ON" : "AUTO-SEND OFF"}</span>
    </div>
  );
}
