"use client";

import { useEffect, useState } from "react";

interface StatusChecks {
  turso: boolean;
  n8n: boolean;
  anthropic: boolean;
  instagram: boolean;
}

export default function StatusBanner() {
  const [checks, setChecks] = useState<StatusChecks | null>(null);
  const [allOk, setAllOk] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        setChecks(data.checks);
        setAllOk(data.ok);
      })
      .catch(() => {});
  }, []);

  if (!checks || allOk) return null;

  const missing = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return (
    <div className="status-banner">
      <span className="status-banner-icon">!</span>
      <span>
        Setup incomplete — missing:{" "}
        {missing.map((m, i) => (
          <span key={m}>
            <strong>{m}</strong>
            {i < missing.length - 1 ? ", " : ""}
          </span>
        ))}
      </span>
    </div>
  );
}
